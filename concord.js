// Copyright 2020-2021, Dave Winer
// Copyright 2013, Small Picture, Inc.

$(function () {
	if ($.fn.tooltip !== undefined) {
		$("a[rel=tooltip]").tooltip({
			live: true
		})
	}
})

$(function () {
	if ($.fn.popover !== undefined) {
		$("a[rel=popover]").on("mouseenter mouseleave", function () { $(this).popover("toggle") })
	}
})

if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function (obj, start) {
		for (let i = (start || 0), j = this.length; i < j; i++) {
			if (this[i] === obj) { return i; }
		}
		return -1;
	}
}

const concord = {
	version: "3.0.5",
	mobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent),
	ready: false,
	handleEvents: true,
	resumeCallbacks: [],
	onResume: function (cb) {
		this.resumeCallbacks.push(cb);
	},
	resumeListening: function () {
		if (!this.handleEvents) {
			this.handleEvents = true;
			const r = this.getFocusRoot();
			if (r != null) {
				const c = new ConcordOutline(r.parent());
				if (c.op.inTextMode()) {
					c.op.focusCursor();
					c.editor.restoreSelection();
				} else {
					c.pasteBinFocus();
				}

				for (let i in this.resumeCallbacks) {
					const cb = this.resumeCallbacks[i];
					cb();
				}
				this.resumeCallbacks = [];
			}
		}
	},
	stopListening: function () {
		if (this.handleEvents) {
			this.handleEvents = false;
			const r = this.getFocusRoot();
			if (r != null) {
				const c = new ConcordOutline(r.parent());
				if (c.op.inTextMode()) {
					c.editor.saveSelection();
				}
			}
		}
	},
	focusRoot: null,
	getFocusRoot: function () {
		if ($(".concord-root:visible").length === 1) {
			return this.setFocusRoot($(".concord-root:visible:first"));
		}
		if ($(".modal").is(":visible")) {
			if ($(".modal").find(".concord-root:visible:first").length === 1) {
				return this.setFocusRoot($(".modal").find(".concord-root:visible:first"));
			}
		}
		if (this.focusRoot == null) {
			if ($(".concord-root:visible").length > 0) {
				return this.setFocusRoot($(".concord-root:visible:first"));
			} else {
				return null;
			}
		}
		if (!this.focusRoot.is(":visible")) {
			return this.setFocusRoot($(".concord-root:visible:first"));
		}
		return this.focusRoot;
	},
	setFocusRoot: function (root) {
		const origRoot = this.focusRoot;
		const concordInstance = new ConcordOutline(root.parent());
		if ((origRoot != null) && !(origRoot[0] === root[0])) {
			const origConcordInstance = new ConcordOutline(origRoot.parent());
			origConcordInstance.editor.hideContextMenu();
			origConcordInstance.editor.dragModeExit();
			if (concordInstance.op.inTextMode()) {
				concordInstance.op.focusCursor();
			}
			else {
				concordInstance.pasteBinFocus();
			}
		}
		this.focusRoot = root;
		return this.focusRoot;
	},
	updateFocusRootEvent: function (event) {
		const root = $(event.target).parents(".concord-root:first");
		if (root.length === 1) {
			concord.setFocusRoot(root);
		}
	}
};

const concordEnvironment = {
	"version": concord.version
};

let concordClipboard = undefined;
let flConcordScrollEnabled = true; //6/24/14 by DW
let ctPixelsAboveOutlineArea = 0; //6/24/14 by DW

jQuery.fn.reverse = [].reverse;

//Constants
const nil = null;
const infinity = Number.MAX_VALUE;
const down = "down";
const left = "left";
const right = "right";
const up = "up";
const flatup = "flatup";
const flatdown = "flatdown";
const nodirection = "nodirection";
const XML_CHAR_MAP = {
	'<': '&lt;',
	'>': '&gt;',
	'&': '&amp;',
	'"': '&' + 'quot;'
};

const ConcordUtil = {
	escapeXml: function (s) {
		s = s.toString();
		s = s.replace(/\u00A0/g, " ");
		const escaped = s.replace(/[<>&"]/g, function (ch) {
			return XML_CHAR_MAP[ch];
		});
		return escaped;
	},
	stringMid: function (s, ix, len) { //1/27/20 by DW
		return (s.substr(ix - 1, len));
	},
	stringDelete: function (s, ix, ct) { //1/27/20 by DW
		const start = ix - 1;
		const end = (ix + ct) - 1;
		const s1 = s.substr(0, start);
		const s2 = s.substr(end);
		return (s1 + s2);
	},
	endsWith: function (s, possibleEnding, flUnicase) { //1/27/20 by DW
		function stringLower(s) {
			return (s.toLowerCase());
		}
		if (s === undefined || s.length === 0) {
			return false;
		}

		const ixstring = s.length - 1;
		if (flUnicase === undefined) {
			flUnicase = true;
		}
		if (flUnicase) {
			for (let i = possibleEnding.length - 1; i >= 0; i--) {
				if (stringLower(s[ixstring--]) != stringLower(possibleEnding[i])) {
					return false;
				}
			}
		} else {
			for (let i = possibleEnding.length - 1; i >= 0; i--) {
				if (s[ixstring--] != possibleEnding[i]) {
					return false;
				}
			}
		}
		return (true);
	},
	speakerBeep: function () { //1/27/20 by DW
		try {
			speakerBeep();
		}
		catch (err) {
			console.log("beep");
		}
	},
	getIconHtml: function (iconName) { //1/30/20 by DW 
		let faClass = "far";
		if (iconName == "caret-right") {
			faClass = "fas";
		}
		if (iconName == "twitter") {
			faClass = "fab";
		}
		if (iconName == "markdown") {
			faClass = "fab";
		}
		if (iconName == "rss") { //3/11/22 by DW
			faClass = "fas";
		}
		return ("<i class=\"node-icon " + faClass + " fa-" + iconName + "\"></i>");
	},
	getKeystroke: function (event) { //2/12/20 by DW
		const concordKeystrokes = {
			"backspace": "backspace",
			"tab": "tab",
			"return": "return",
			"delete": "delete",
			"uparrow": "cursor-up",
			"downarrow": "cursor-down",
			"leftarrow": "cursor-left",
			"rightarrow": "cursor-right",

			"meta-A": "select-all",
			"meta-B": "bolden",
			"meta-C": "copy",
			"meta-D": "reorg-down",
			"meta-F": "find", //9/19/13 by DW
			"meta-I": "italicize",
			"meta-L": "reorg-left",
			"meta-R": "reorg-right",
			"meta-U": "reorg-up",
			"meta-V": "paste",
			"meta-X": "cut",
			"meta-Z": "undo",

			"meta-[": "promote",
			"meta-]": "demote",

			"meta-\\": "toggle-comment",
			"meta-/": "run-selection",
			"meta-`": "toggle-render",
			"meta-,": "toggle-expand"
		};

		function concordMetaizeKeystroke(event) { //9/17/13 by DW
			const flmeta = event.metaKey || event.ctrlKey;
			function checkspecials(ch) {
				const specials =  {
					8: "backspace",
					9: "tab",
					13: "return",
					33: "pageup",
					34: "pagedown",
					35: "end",
					36: "home",
					37: "leftarrow",
					38: "uparrow",
					39: "rightarrow",
					40: "downarrow",
					46: "delete",
					188: ",",
					190: ".",
					191: "/",
					192: "`",
					219: "[",
					220: "\\",
					221: "]",
				};				
				return (specials.hasOwnProperty(ch) ? specials[ch] : ch);
			}
			
			const ch = event.which;
			if (ch >= 65 && ch <= 90) { //meta-A through meta-Z
				if (flmeta) {
					return ("meta-" + String.fromCharCode(ch));
				}
			}
			else {
				if (ch >= 48 && ch <= 57) { //meta-0 through meta-9 -- 4/20/21 by DW
					if (flmeta) {
						return "meta-" + String.fromCharCode(ch);
					}
				}
			}
			return flmeta ? "meta-" + checkspecials(ch) : checkspecials(ch);
		}

		const s = concordMetaizeKeystroke(event);
		if (concordKeystrokes[s] !== undefined) {
			const val = concordKeystrokes[s];
			if (val.length > 0) { //2/23/14 by DW
				return val;
			}
		}
		return s;
	}
};

function ConcordOutline(container, options) {
	this.container = container;
	this.options = options;
	this.id = null;
	this.root = null;
	this.editor = null;
	this.op = null;
	this.script = null;
	this.pasteBin = null;
	this.pasteBinFocus = function () {
		if (!concord.ready) {
			return;
		}
		if (concord.mobile) {
			return;
		}
		if (this.root.is(":visible")) {
			const node = this.op.getCursor();
			const nodeOffset = node.offset();
			this.pasteBin.offset(nodeOffset);
			this.pasteBin.css("z-index", "1000");
			if ((this.pasteBin.text() == "") || (this.pasteBin.text() == "\n")) {
				this.pasteBin.text("...");
			}
			this.op.focusCursor();
			this.pasteBin.focus();
			if (this.pasteBin[0] === document.activeElement) {
				document.execCommand("selectAll");
			}
		}
	};

	this.callbacks = function (callbacks) {
		if (callbacks) {
			this.root.data("callbacks", callbacks);
			return callbacks;
		} else {
			if (this.root.data("callbacks")) {
				return this.root.data("callbacks");
			} else {
				return {};
			}
		}
	};

	this.fireCallback = function (name, value) {
		const cb = this.callbacks()[name]
		if (cb) {
			cb(value);
		}
	};

	this.prefs = function (newprefs) {
		let prefs = this.root.data("prefs");
		if (prefs == undefined) {
			prefs = {};
		}

		if (newprefs) {
			for (let key in newprefs) {
				prefs[key] = newprefs[key];
			}
			this.root.data("prefs", prefs);
			if (prefs.readonly) {
				this.root.addClass("readonly");
			}
			if (prefs.renderMode !== undefined) {
				this.root.data("renderMode", prefs.renderMode);
			}
			if (prefs.contextMenu) {
				$(prefs.contextMenu).hide();
			}
			const style = {};
			if (prefs.outlineFont) {
				style["font-family"] = prefs.outlineFont;
			}
			if (prefs.outlineFontSize) {
				prefs.outlineFontSize = parseInt(prefs.outlineFontSize);
				style["font-size"] = prefs.outlineFontSize + "px";
				style["min-height"] = (prefs.outlineFontSize + 6) + "px";
				style["line-height"] = (prefs.outlineFontSize + 6) + "px";
			}

			if (prefs.outlineLineHeight) {
				prefs.outlineLineHeight = parseInt(prefs.outlineLineHeight);
				style["min-height"] = prefs.outlineLineHeight + "px";
				style["line-height"] = prefs.outlineLineHeight + "px";
			}

			this.root.parent().find("style.prefsStyle").remove();
			let css = '<style type="text/css" class="prefsStyle">\n';
			let cssId = "";
			if (this.root.parent().attr("id")) {
				cssId = "#" + this.root.parent().attr("id");
			}
			css += cssId + ' .concord .concord-node .concord-wrapper .concord-text {';
			for (let attribute in style) {
				css += attribute + ': ' + style[attribute] + ';';
			}
			css += '}\n';
			css += cssId + ' .concord .concord-node .concord-wrapper .node-icon {';
			for (let attribute in style) {
				if (attribute != "font-family") {
					css += attribute + ': ' + style[attribute] + ';';
				}
			}
			css += '}\n';

			const wrapperPaddingLeft = prefs.outlineLineHeight;
			if (wrapperPaddingLeft === undefined) {
				wrapperPaddingLeft = prefs.outlineFontSize;
			}

			if (wrapperPaddingLeft !== undefined) {
				css += cssId + ' .concord .concord-node .concord-wrapper {';
				css += "padding-left: " + wrapperPaddingLeft + "px";
				css += "}\n";
				css += cssId + ' .concord ol {';
				css += "padding-left: " + wrapperPaddingLeft + "px";
				css += "}\n";
			}

			css += '</style>\n';
			this.root.before(css);
			if (newprefs.css) {
				this.op.setStyle(newprefs.css);
			}
		}
		return prefs;
	};

	this.afterInit = function () {
		this.editor = new ConcordEditor(this.root, this);
		this.op = new ConcordOp(this.root, this);
		this.script = new ConcordScript(this.root, this);
		if (options) {
			if (options.prefs) {
				this.prefs(options.prefs);
			}
			if (options.open) {
				this.root.data("open", options.open);
			}
			if (options.save) {
				this.root.data("save", options.save);
			}
			if (options.callbacks) {
				this.callbacks(options.callbacks);
			}
			if (options.id) {
				this.root.data("id", options.id);
				this.open();
			}
		}
	};

	this.init = function () {
		if ($(container).find(".concord-root:first").length > 0) {
			this.root = $(container).find(".concord-root:first");
			this.pasteBin = $(container).find(".pasteBin:first");
			this.afterInit();
			return;
		}
		const root = $("<ol></ol>");
		root.addClass("concord concord-root");
		root.appendTo(container);
		this.root = root;

		const pasteBin = $('<div class="pasteBin" contenteditable="true" style="position: absolute; height: 1px; width:1px; outline:none; overflow:hidden;"></div>');
		pasteBin.appendTo(container);
		this.pasteBin = pasteBin;
		this.afterInit();
		this.events = new ConcordEvents(this.root, this.editor, this.op, this);
	};

	this["new"] = function () {
		this.op.wipe();
	};
	this.open = function (cb) {
		const opmlId = this.root.data("id");
		if (!opmlId) {
			return;
		}
		const root = this.root;
		const op = this.op;
		const openUrl = "http://concord.smallpicture.com/open";
		if (root.data("open")) {
			openUrl = root.data("open");
		}
		params = {}
		if (opmlId.match(/^http.+$/)) {
			params["url"] = opmlId
		} else {
			params["id"] = opmlId
		}

		$.ajax({
			type: 'POST',
			url: openUrl,
			data: params,
			dataType: "xml",
			success: function (opml) {
				if (opml) {
					op.xmlToOutline(opml);
					if (cb) {
						cb();
					}
				}
			},
			error: function () {
				if (root.find(".concord-node").length === 0) {
					op.wipe();
				}
			}
		});
	};

	this.save = function (cb) {
		const opmlId = this.root.data("id");
		if (opmlId && this.op.changed()) {
			const saveUrl = "http://concord.smallpicture.com/save";
			if (this.root.data("save")) {
				saveUrl = this.root.data("save");
			}
			const concordInstance = this;
			const opml = this.op.outlineToXml();
			$.ajax({
				type: 'POST',
				url: saveUrl,
				data: {
					"opml": opml,
					"id": opmlId
				},
				dataType: "json",
				success: function (json) {
					concordInstance.op.clearChanged();
					if (cb) {
						cb(json);
					}
				}
			});
		}
	};

	this["import"] = function (opmlId, cb) {
		const openUrl = "http://concordold.smallpicture.com/open";
		const root = this.root;
		const concordInstance = this;
		if (root.data("open")) {
			openUrl = root.data("open");
		}

		params = {};

		if (opmlId.match(/^http.+$/)) {
			params["url"] = opmlId;
		} else {
			params["id"] = opmlId;
		}

		$.ajax({
			type: 'POST',
			url: openUrl,
			data: params,
			dataType: "xml",
			success: function (opml) {
				if (opml) {
					const cursor = root.find(".concord-cursor:first");

					$(opml).find("body").children("outline").each(function () {
						const node = concordInstance.editor.build($(this));
						cursor.after(node);
						cursor = node;
					});

					concordInstance.op.markChanged();
					if (cb) {
						cb();
					}
				}
			},
			error: function () {
			}
		});
	};

	this["export"] = function () {
		let context = this.root.find(".concord-cursor:first");
		if (context.length === 0) {
			context = this.root.find(".concord-root:first");
		}
		return this.editor.opml(context);
	};
	this.init();
}

function ConcordEditor(root, concordInstance) {
	this.makeNode = function () {
		const node = $("<li></li>");
		node.addClass("concord-node");
		const wrapper = $("<div class='concord-wrapper'></div>");

		const icon = ConcordUtil.getIconHtml("caret-right");
		wrapper.append(icon);
		wrapper.addClass("type-icon");
		const text = $("<div class='concord-text' contenteditable='true'></div>");
		const outline = $("<ol></ol>");
		text.appendTo(wrapper);
		wrapper.appendTo(node);
		outline.appendTo(node);
		return node;
	};

	this.dragMode = function () {
		root.data("draggingChange", root.children().clone(true, true));
		root.addClass("dragging");
		root.data("dragging", true);
	};

	this.dragModeExit = function () {
		if (root.data("dragging")) {
			concordInstance.op.markChanged();
			root.data("change", root.data("draggingChange"));
			root.data("changeTextMode", false);
			root.data("changeRange", undefined);
		}
		root.find(".draggable").removeClass("draggable");
		root.find(".drop-sibling").removeClass("drop-sibling");
		root.find(".drop-child").removeClass("drop-child");
		root.removeClass("dragging");
		root.data("dragging", false);
		root.data("mousedown", false);
	};

	this.edit = function (node, empty) {
		const text = node.children(".concord-wrapper:first").children(".concord-text:first");
		if (empty) {
			text.html("");
		}
		text.focus();
		const el = text.get(0);
		if (el && el.childNodes && el.childNodes[0]) {
			if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
				const range = document.createRange();
				range.selectNodeContents(el);
				range.collapse(false);
				const sel = window.getSelection();
				sel.removeAllRanges();
				sel.addRange(range);
			} else if (typeof document.body.createTextRange != "undefined") {
				const textRange = document.body.createTextRange();
				textRange.moveToElementText(el);
				textRange.collapse(false);
				textRange.select();
			}
		}
		text.addClass("editing");
		if (!empty) {
			if (root.find(".concord-node.dirty").length > 0) {
				concordInstance.op.markChanged();
			}
		}
	};

	this.editable = function (target) {
		let editable = false;
		if (!target.hasClass("concord-text")) {
			target = target.parents(".concord-text:first");
		}
		if (target.length === 1) {
			editable = target.hasClass("concord-text") && target.hasClass("editing");
		}
		return editable;
	};

	this.editorMode = function () {
		root.find(".selected").removeClass("selected");
		root.find(".editing").each(function () {
			$(this).removeClass("editing");
		});
		root.find(".selection-toolbar").remove();
	};

	this.opml = function (_root, flsubsonly) {
		if (flsubsonly == undefined) { //8/5/13 by DW
			flsubsonly = false;
		}

		if (_root) {
			root = _root;
		}
		const title = root.data("title");
		if (!title) {
			if (root.hasClass("concord-node")) {
				title = root.children(".concord-wrapper:first").children(".concord-text:first").text();
			}
			else {
				title = "";
			}
		}

		let opml = '<?xml version="1.0"?>\n';
		opml += '<opml version="2.0">\n';
		opml += '<head>\n';
		opml += '<title>' + ConcordUtil.escapeXml(title) + '</title>\n';
		opml += '</head>\n';
		opml += '<body>\n';

		if (root.hasClass("concord-cursor")) {
			opml += this.opmlLine(root, 0, flsubsonly);
		} else {
			const editor = this;
			root.children(".concord-node").each(function () {
				opml += editor.opmlLine($(this));
			});
		}
		opml += '</body>\n';
		opml += '</opml>\n';
		return opml;
	};

	this.opmlLine = function (node, indent, flsubsonly) {
		if (indent == undefined) {
			indent = 0;
		}

		if (flsubsonly == undefined) {
			flsubsonly = false;
		}

		let text = this.unescape(node.children(".concord-wrapper:first").children(".concord-text:first").html());
		const textMatches = text.match(/^(.+)<br>\s*$/);
		if (textMatches) {
			text = textMatches[1];
		}
		let opml = '';
		for (let i = 0; i < indent; i++) {
			opml += '\t';
		}

		let subheads;
		if (!flsubsonly) {
			opml += '<outline text="' + ConcordUtil.escapeXml(text) + '"';
			const attributes = node.data("attributes");
			if (attributes === undefined) {
				attributes = {};
			}
			for (let name in attributes) {
				if ((name !== undefined) && (name != "") && (name != "text")) {
					if (attributes[name] !== undefined) {
						opml += ' ' + name + '="' + ConcordUtil.escapeXml(attributes[name]) + '"';
					}
				}
			}
			subheads = node.children("ol").children(".concord-node");
			if (subheads.length === 0) {
				opml += "/>\n";
				return opml;
			}
			opml += ">\n";
		}
		else {
			subheads = node.children("ol").children(".concord-node");
		}

		const editor = this;
		indent++;
		subheads.each(function () {
			opml += editor.opmlLine($(this), indent);
		});

		if (!flsubsonly) { //8/5/13 by DW
			for (let i = 0; i < indent; i++) {
				opml += '\t';
			}
			opml += '</outline>\n';
		}

		return opml;
	};

	this.textLine = function (node, indent) {
		if (!indent) {
			indent = 0;
		}
		let text = "";
		for (let i = 0; i < indent; i++) {
			text += "\t";
		}
		text += this.unescape(node.children(".concord-wrapper:first").children(".concord-text:first").html());
		text += "\n";
		const editor = this;
		node.children("ol").children(".concord-node").each(function () {
			text += editor.textLine($(this), indent + 1);
		});
		return text;
	};

	this.select = function (node, multiple, multipleRange) {
		if (multiple == undefined) {
			multiple = false;
		}
		if (multipleRange == undefined) {
			multipleRange = false;
		}
		if (node.length === 1) {
			this.selectionMode(multiple);
			if (multiple) {
				node.parents(".concord-node.selected").removeClass("selected");
				node.find(".concord-node.selected").removeClass("selected");
			}
			if (multiple && multipleRange) {
				const prevNodes = node.prevAll(".selected");
				if (prevNodes.length > 0) {
					let stamp = false;
					node.prevAll().reverse().each(function () {
						if ($(this).hasClass("selected")) {
							stamp = true;
						} else if (stamp) {
							$(this).addClass("selected");
						}
					});
				} else {
					const nextNodes = node.nextAll(".selected");
					if (nextNodes.length > 0) {
						let stamp = true;
						node.nextAll().each(function () {
							if ($(this).hasClass("selected")) {
								stamp = false;
							} else if (stamp) {
								$(this).addClass("selected");
							}
						});
					}
				}
			}
			const text = node.children(".concord-wrapper:first").children(".concord-text:first");
			if (text.hasClass("editing")) {
				text.removeClass("editing");
			}

			//text.blur();
			node.addClass("selected");
			if (text.text().length > 0) {
				//root.data("currentChange", root.children().clone());
			}

			this.dragModeExit();
		}
		if (root.find(".concord-node.dirty").length > 0) {
			concordInstance.op.markChanged();
		}
	};

	this.selectionMode = function (multiple) {
		if (multiple == undefined) {
			multiple = false;
		}
		const node = root.find(".concord-cursor");
		if (node.length === 1) {
			const text = node.children(".concord-wrapper:first").children(".concord-text:first");
			if (text.length === 1) {
				//text.blur();
			}
		}
		if (!multiple) {
			root.find(".selected").removeClass("selected");
		}
		root.find(".selection-toolbar").remove();
	};

	this.build = function (outline, collapsed, level, flInsertRawHtml) {
		if (!level) {
			level = 1;
		}
		const node = $("<li></li>");
		node.addClass("concord-node");
		node.addClass("concord-level-" + level);
		const attributes = {};
		$(outline[0].attributes).each(function () {
			if (this.name != 'text') {
				attributes[this.name] = this.value;
				if (this.name == "type") {
					node.attr("opml-" + this.name, this.value);
				}
			}
		});

		node.data("attributes", attributes);
		const wrapper = $("<div class='concord-wrapper'></div>");
		let nodeIcon = attributes["icon"];
		if (!nodeIcon) {
			nodeIcon = attributes["type"];
		}

		let iconName = "caret-right";
		if (nodeIcon) {
			if ((nodeIcon == node.attr("opml-type")) && concordInstance.prefs() && concordInstance.prefs().typeIcons && concordInstance.prefs().typeIcons[nodeIcon]) {
				iconName = concordInstance.prefs().typeIcons[nodeIcon];
			} else if (nodeIcon == attributes["icon"]) {
				iconName = nodeIcon;
			}
		}
		const icon = ConcordUtil.getIconHtml(iconName);
		wrapper.append(icon);
		wrapper.addClass("type-icon");
		if (attributes["isComment"] == "true") {
			node.addClass("concord-comment");
		}
		const text = $("<div class='concord-text' contenteditable='true'></div>");
		text.addClass("concord-level-" + level + "-text");

		const textToInsert = flInsertRawHtml ? outline.attr('text') : this.escape(outline.attr('text'));
		text.html(textToInsert);

		if (attributes["cssTextClass"] !== undefined) {
			const cssClasses = attributes["cssTextClass"].split(/\s+/);
			for (let c in cssClasses) {
				const newClass = cssClasses[c];
				text.addClass(newClass);
			}
		}

		const children = $("<ol></ol>");
		const editor = this;
		outline.children("outline").each(function () {
			const child = editor.build($(this), collapsed, level + 1, flInsertRawHtml);
			child.appendTo(children);
		});

		if (collapsed) {
			if (outline.children("outline").length > 0) {
				node.addClass("collapsed");
			}
		}

		text.appendTo(wrapper);
		wrapper.appendTo(node);
		children.appendTo(node);
		return node;
	};

	this.hideContextMenu = function () {
		if (root.data("dropdown")) {
			root.data("dropdown").hide();
			root.data("dropdown").remove();
			root.removeData("dropdown");
		}
	};

	this.showContextMenu = function (x, y) {
		if (concordInstance.prefs().contextMenu) {
			this.hideContextMenu();
			root.data("dropdown", $(concordInstance.prefs().contextMenu).clone().appendTo(concordInstance.container));
			const editor = this;
			root.data("dropdown").on("click", "a", function (event) {
				editor.hideContextMenu();
			});
			root.data("dropdown").css({ "position": "absolute", "top": y + "px", "left": x + "px", "cursor": "default" });
			root.data("dropdown").show();
		}
	};

	this.sanitize = function () {
		root.find(".concord-text.paste").each(function () {
			const concordText = $(this);
			if (concordInstance.pasteBin.text() == "...") {
				return;
			}

			let h = concordInstance.pasteBin.html();
			h = h.replace(new RegExp("<(div|p|blockquote|pre|li|br|dd|dt|code|h\\d)[^>]*(/)?>", "gi"), "\n");
			h = $("<div/>").html(h).text();

			let clipboardMatch = false;
			if (concordClipboard !== undefined) {
				const trimmedClipboardText = concordClipboard.text.replace(/^[\s\r\n]+|[\s\r\n]+$/g, '');
				const trimmedPasteText = h.replace(/^[\s\r\n]+|[\s\r\n]+$/g, '');
				if (trimmedClipboardText == trimmedPasteText) {
					const clipboardNodes = concordClipboard.data;
					if (clipboardNodes) {
						const collapseNode = function (node) {
							node.find("ol").each(function () {
								if ($(this).children().length > 0) {
									$(this).parent().addClass("collapsed");
								}
							});
						};
						clipboardNodes.each(function () {
							collapseNode($(this));
						});
						root.data("clipboard", clipboardNodes);
						concordInstance.op.setTextMode(false);
						concordInstance.op.paste();
						clipboardMatch = true;
					}
				}
			}
			if (!clipboardMatch) {
				concordClipboard = undefined;
				const numberOfLines = h.split("\n").filter(l => l != "" && !l.match(/^\s+$/)).length;

				if (!concordInstance.op.inTextMode() || (numberOfLines > 1)) {
					concordInstance.op.insertText(h);
				} else {
					concordInstance.op.saveState();
					concordText.focus();
					const range = concordText.parents(".concord-node:first").data("range");
					if (range) {
						try {
							const sel = window.getSelection();
							sel.removeAllRanges();
							sel.addRange(range);
						}
						catch (e) {
							console.log(e);
						}
						finally {
							concordText.parents(".concord-node:first").removeData("range");
						}
					}
					document.execCommand("insertText", null, h);
					concordInstance.root.removeData("clipboard");
					concordInstance.op.markChanged();
				}
			}
			concordText.removeClass("paste");
		});
	};

	this.escape = function (s) {
		let h = $("<div/>").text(s).html();
		h = h.replace(/\u00A0/g, " ");
		if (concordInstance.op.getRenderMode()) { // Render HTML if op.getRenderMode() returns true - 2/17/13 by KS
			const allowedTags = ["b", "strong", "i", "em", "a", "img", "strike", "del"];
			for (let tagIndex in allowedTags) {
				const tag = allowedTags[tagIndex];
				if (tag == "img") {
					h = h.replace(new RegExp("&lt;" + tag + "((?!&gt;).+)(/)?&gt;", "gi"), "<" + tag + "$1" + "/>");
				} else if (tag == "a") {
					h = h.replace(new RegExp("&lt;" + tag + "((?!&gt;).*?)&gt;((?!&lt;/" + tag + "&gt;).+?)&lt;/" + tag + "&gt;", "gi"), "<" + tag + "$1" + ">$2" + "<" + "/" + tag + ">");
				} else {
					h = h.replace(new RegExp("&lt;" + tag + "&gt;((?!&lt;/" + tag + "&gt;).+?)&lt;/" + tag + "&gt;", "gi"), "<" + tag + ">$1" + "<" + "/" + tag + ">");
				}
			}
		}
		return h;
	};

	this.unescape = function (s) {
		let h = s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
		h = $("<div/>").html(h).text();
		return h;
	};

	this.getSelection = function () {
		let range = undefined;
		if (window.getSelection) {
			sel = window.getSelection();
			if (sel.getRangeAt && sel.rangeCount) {
				range = sel.getRangeAt(0);
				if ($(range.startContainer).parents(".concord-node:first").length === 0) {
					range = undefined;
				}
			}
		}
		return range;
	};

	this.saveSelection = function () {
		const range = this.getSelection();
		if (range !== undefined) {
			concordInstance.op.getCursor().data("range", range.cloneRange());
		}
		return range;
	};

	this.restoreSelection = function (range) {
		const cursor = concordInstance.op.getCursor();
		if (range === undefined) {
			range = cursor.data("range");
		}
		if (range !== undefined) {
			if (window.getSelection) {
				try {
					const sel = window.getSelection();
					sel.removeAllRanges();
					sel.addRange(range.cloneRange());
				}
				catch (e) {
					console.log(e);
				}
				finally {
					cursor.removeData("range");
				}
			}
		}
		return range;
	};

	this.recalculateLevels = function (context) {
		if (!context) {
			context = root.find(".concord-node");
		}
		context.each(function () {
			const text = $(this).children(".concord-wrapper").children(".concord-text");
			const levelMatch = $(this).attr("class").match(/.*concord-level-(\d+).*/);
			if (levelMatch) {
				$(this).removeClass("concord-level-" + levelMatch[1]);
				text.removeClass("concord-level-" + levelMatch[1] + "-text");
			}
			const level = $(this).parents(".concord-node").length + 1;
			$(this).addClass("concord-level-" + level);
			text.addClass("concord-level-" + level + "-text");
		});
	};
}

function ConcordEvents(root, editor, op, concordInstance) {
	const instance = this;
	this.wrapperDoubleClick = function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (root.data("dropdown")) {
			editor.hideContextMenu();
			return;
		}
		if (!editor.editable($(event.target))) {
			let wrapper = $(event.target);
			if (wrapper.hasClass("node-icon")) {
				wrapper = wrapper.parent();
			}
			if (wrapper.hasClass("concord-wrapper")) {
				event.stopPropagation();
				op.setTextMode(false);
				if (op.subsExpanded()) {
					op.collapse();
				} else {
					op.expand();
				}
			}
		}
	};

	this.clickSelect = function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (root.data("dropdown")) {
			event.stopPropagation();
			editor.hideContextMenu();
			return;
		}
		if (concord.mobile) {
			const node = $(event.target);
			if (concordInstance.op.getCursor()[0] === node[0]) {
				instance.doubleClick(event);
				return;
			}
		}
		if ((event.which === 1) && !editor.editable($(event.target))) {
			const node = $(event.target);
			if (!node.hasClass("concord-node")) {
				return;
			}
			if (node.length === 1) {
				event.stopPropagation();
				if (event.shiftKey && (node.parents(".concord-node.selected").length > 0)) {
					return;
				}
				op.setTextMode(false);
				op.setCursor(node, event.shiftKey || event.metaKey, event.shiftKey);
			}
		}
	};

	this.doubleClick = function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (root.data("dropdown")) {
			editor.hideContextMenu();
			return;
		}
		if (!editor.editable($(event.target))) {
			const node = $(event.target);
			if (node.hasClass("concord-node") && node.hasClass("concord-cursor")) {
				event.stopPropagation();
				op.setTextMode(false);
				op.setCursor(node);
				if (op.subsExpanded()) {
					op.collapse();
				} else {
					op.expand();
				}
			}
		}
	};

	this.wrapperClickSelect = function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (root.data("dropdown")) {
			editor.hideContextMenu();
			return;
		}
		if (concord.mobile) {
			const target = $(event.target);
			const node = target.parents(".concord-node:first");
			if (concordInstance.op.getCursor()[0] === node[0]) {
				instance.wrapperDoubleClick(event);
				return;
			}
		}
		if ((event.which === 1) && !editor.editable($(event.target))) {
			let wrapper = $(event.target);
			if (wrapper.hasClass("node-icon")) {
				wrapper = wrapper.parent();
			}
			if (wrapper.hasClass("concord-wrapper")) {
				const node = wrapper.parents(".concord-node:first");
				if (event.shiftKey && (node.parents(".concord-node.selected").length > 0)) {
					return;
				}
				op.setTextMode(false);
				op.setCursor(node, event.shiftKey || event.metaKey, event.shiftKey);
			}
		}
	};

	this.contextmenu = function (event) {
		if (!concord.handleEvents) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		const node = $(event.target);
		if (node.hasClass("concord-wrapper") || node.hasClass("node-icon")) {
			op.setTextMode(false);
		}
		if (!node.hasClass("concord-node")) {
			node = node.parents(".concord-node:first");
		}
		concordInstance.fireCallback("opContextMenu", op.setCursorContext(node));
		op.setCursor(node);
		editor.showContextMenu(event.pageX, event.pageY);
	};

	root.on("dblclick", ".concord-wrapper", this.wrapperDoubleClick);
	root.on("dblclick", ".concord-node", this.doubleClick);
	root.on("dblclick", ".concord-text", function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (concordInstance.prefs()["readonly"]) {
			event.preventDefault();
			event.stopPropagation();
			const node = $(event.target).parents(".concord-node:first");
			op.setCursor(node);
			if (op.subsExpanded()) {
				op.collapse();
			} else {
				op.expand();
			}
		}
	});

	root.on("click", ".concord-wrapper", this.wrapperClickSelect);
	root.on("click", ".concord-node", this.clickSelect);
	root.on("mouseover", ".concord-wrapper", function (event) {
		if (!concord.handleEvents) {
			return;
		}
		const node = $(event.target).parents(".concord-node:first");
		concordInstance.fireCallback("opHover", op.setCursorContext(node));
	})
	if (concordInstance.prefs.contextMenu) {
		root.on("contextmenu", ".concord-text", this.contextmenu);
		root.on("contextmenu", ".concord-node", this.contextmenu);
		root.on("contextmenu", ".concord-wrapper", this.contextmenu);
	}

	root.on("blur", ".concord-text", function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (concordInstance.prefs()["readonly"]) {
			return;
		}
		if ($(this).html().match(/^\s*<br>\s*$/)) {
			$(this).html("");
		}
		const node = $(this).parents(".concord-node:first");
		if (concordInstance.op.inTextMode()) {
			editor.saveSelection();
		}
		if (concordInstance.op.inTextMode() && node.hasClass("dirty")) {
			node.removeClass("dirty");
		}
	});

	root.on("paste", ".concord-text", function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (concordInstance.prefs()["readonly"]) {
			return;
		}
		$(this).addClass("paste");
		concordInstance.editor.saveSelection();
		concordInstance.pasteBin.html("");
		concordInstance.pasteBin.focus();
		setTimeout(editor.sanitize, 10);
	});

	concordInstance.pasteBin.on("copy", function () {
		if (!concord.handleEvents) {
			return;
		}

		let copyText = "";
		root.find(".selected").each(function () {
			copyText += concordInstance.editor.textLine($(this));
		});

		if (copyText != "" && copyText != "\n") {
			concordClipboard = { text: copyText, data: root.find(".selected").clone(true, true) };
			concordInstance.pasteBin.html("<pre>" + $("<div/>").text(copyText).html() + "</pre>");
			concordInstance.pasteBin.focus();
			document.execCommand("selectAll");
		}
	});

	concordInstance.pasteBin.on("paste", function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (concordInstance.prefs()["readonly"]) {
			return;
		}
		const concordText = concordInstance.op.getCursor().children(".concord-wrapper").children(".concord-text");
		concordText.addClass("paste");
		concordInstance.pasteBin.html("");
		setTimeout(editor.sanitize, 10);
	});

	concordInstance.pasteBin.on("cut", function () {
		if (!concord.handleEvents || concordInstance.prefs()["readonly"]) {
			return;
		}

		let copyText = "";
		root.find(".selected").each(function () {
			copyText += concordInstance.editor.textLine($(this));
		});
		if (copyText != "" && copyText != "\n") {
			concordClipboard = { text: copyText, data: root.find(".selected").clone(true, true) };
			concordInstance.pasteBin.html("<pre>" + $("<div/>").text(copyText).html() + "</pre>");
			concordInstance.pasteBinFocus();
		}
		concordInstance.op.deleteLine();
		setTimeout(function () { concordInstance.pasteBinFocus() }, 200);
	});

	root.on("mousedown", function (event) {
		if (!concord.handleEvents) {
			return;
		}

		let target = $(event.target);
		if (target.is("a")) {
			if (target.attr("href")) {
				event.preventDefault();
				window.open(target.attr("href"));
			}
			return;
		}
		if (concordInstance.prefs()["readonly"]) {
			event.preventDefault();
			let target = $(event.target);
			if (target.parents(".concord-text:first").length === 1) {
				target = target.parents(".concord-text:first");
			}
			if (target.hasClass("concord-text")) {
				const node = target.parents(".concord-node:first");
				if (node.length === 1) {
					op.setCursor(node);
				}
			}
			return;
		}
		if (event.which === 1) {
			if (root.data("dropdown")) {
				editor.hideContextMenu();
				return;
			}
			if (target.parents(".concord-text:first").length === 1) {
				target = target.parents(".concord-text:first");
			}
			if (target.hasClass("concord-text")) {
				const node = target.parents(".concord-node:first");
				if (node.length === 1) {
					if (!root.hasClass("textMode")) {
						root.find(".selected").removeClass("selected");
						root.addClass("textMode");
					}
					if (node.children(".concord-wrapper").children(".concord-text").hasClass("editing")) {
						root.find(".editing").removeClass("editing");
						node.children(".concord-wrapper").children(".concord-text").addClass("editing");
					}
					if (!node.hasClass("concord-cursor")) {
						root.find(".concord-cursor").removeClass("concord-cursor");
						node.addClass("concord-cursor");
						concordInstance.fireCallback("opCursorMoved", op.setCursorContext(node));
					}
				}
			} else {
				event.preventDefault();
				root.data("mousedown", true);
			}
		}
	});

	root.on("mousemove", function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (concordInstance.prefs()["readonly"]) {
			return;
		}
		if (!editor.editable($(event.target))) {
			event.preventDefault();
			if (root.data("mousedown") && !root.data("dragging")) {
				let target = $(event.target);
				if (target.hasClass("node-icon")) {
					target = target.parent();
				}
				if (target.hasClass("concord-wrapper") && target.parent().hasClass("selected")) {
					editor.dragMode();
				}
			}
		}
	});

	root.on("mouseup", function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (concordInstance.prefs()["readonly"]) {
			return;
		}
		let target = $(event.target);
		if (target.hasClass("concord-node")) {
			target = target.children(".concord-wrapper:first").children(".concord-text:first");
		} else if (target.hasClass("concord-wrapper")) {
			target = target.children(".concord-text:first");
		}
		if (!editor.editable(target)) {
			root.data("mousedown", false);
			if (root.data("dragging")) {
				target = $(event.target);
				const node = target.parents(".concord-node:first");
				const draggable = root.find(".selected");
				if ((node.length === 1) && (draggable.length >= 1)) {
					let isDraggableTarget = false;
					draggable.each(function () {
						if (this == node[0]) {
							isDraggableTarget = true;
						}
					});
					if (!isDraggableTarget) {
						let draggableIsTargetParent = false;
						node.parents(".concord-node").each(function () {
							const nodeParent = $(this)[0];
							draggable.each(function () {
								if ($(this)[0] == nodeParent) {
									draggableIsTargetParent = true;
								}
							});
						});
						if (!draggableIsTargetParent) {
							if (target.hasClass("concord-wrapper") || target.hasClass("node-icon")) {
								const clonedDraggable = draggable.clone(true, true);
								clonedDraggable.insertAfter(node);
								draggable.remove();
							} else {
								const clonedDraggable = draggable.clone(true, true);
								const outline = node.children("ol");
								clonedDraggable.prependTo(outline);
								node.removeClass("collapsed");
								draggable.remove();
							}
						}
					} else {
						const prev = node.prev();
						if (prev.length === 1) {
							if (prev.hasClass("drop-child")) {
								const clonedDraggable = draggable.clone(true, true);
								const outline = prev.children("ol");
								clonedDraggable.appendTo(outline);
								prev.removeClass("collapsed");
								draggable.remove();
							}
						}
					}
				}
				editor.dragModeExit();
				concordInstance.editor.recalculateLevels();
			}
		}
	});

	root.on("mouseover", function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (concordInstance.prefs()["readonly"]) {
			return;
		}
		if (root.data("dragging")) {
			event.preventDefault();
			const target = $(event.target);
			const node = target.parents(".concord-node:first");
			const draggable = root.find(".selected");
			if ((node.length === 1) && (draggable.length >= 1)) {
				let isDraggableTarget = false;
				draggable.each(function () {
					if (this == node[0]) {
						isDraggableTarget = true;
					}
				});
				if (!isDraggableTarget) {
					let draggableIsTargetParent = false;
					node.parents(".concord-node").each(function () {
						const nodeParent = $(this)[0];
						draggable.each(function () {
							if ($(this)[0] == nodeParent) {
								draggableIsTargetParent = true;
							}
						});
					});
					if (!draggableIsTargetParent) {
						node.removeClass("drop-sibling").remove("drop-child");
						if (target.hasClass("concord-wrapper") || target.hasClass("node-icon")) {
							node.addClass("drop-sibling");
						} else {
							node.addClass("drop-child");
						}
					}
				} else if (draggable.length === 1) {
					const prev = node.prev();
					if (prev.length === 1) {
						prev.removeClass("drop-sibling").remove("drop-child");
						prev.addClass("drop-child");
					}
				}
			}
		}
	});

	root.on("mouseout", function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if (concordInstance.prefs()["readonly"]) {
			return;
		}
		if (root.data("dragging")) {
			root.find(".drop-sibling").removeClass("drop-sibling");
			root.find(".drop-child").removeClass("drop-child");
		}
	});
}

function ConcordOp(root, concordInstance, _cursor) {
	this._walk_up = function (context) {
		const prev = context.prev();
		if (prev.length === 0) {
			const parent = context.parents(".concord-node:first");
			return parent.length === 1 ? parent : null;
		} else {
			return this._last_child(prev);
		}
	};
	this._walk_down = function (context) {
		const next = context.next();
		if (next.length === 1) {
			return next;
		} else {
			const parent = context.parents(".concord-node:first");
			if (parent.length === 1) {
				return this._walk_down(parent);
			} else {
				return null;
			}
		}
	};
	this._last_child = function (context) {
		if (context.hasClass("collapsed")) {
			return context;
		}
		const outline = context.children("ol");
		if (outline.length === 0) {
			return context;
		} else {
			const lastChild = outline.children(".concord-node:last");
			if (lastChild.length === 1) {
				return this._last_child(lastChild);
			} else {
				return context;
			}
		}
	};
	this.bold = function () {
		this.saveState();
		if (this.inTextMode()) {
			document.execCommand("bold");
		} else {
			this.focusCursor();
			document.execCommand("selectAll");
			document.execCommand("bold");
			document.execCommand("unselect");
			this.blurCursor();
			concordInstance.pasteBinFocus();
		}
		this.markChanged();
	};
	this.changed = function () {
		return root.data("changed") == true;
	};

	this.clearChanged = function () {
		root.data("changed", false);
		return true;
	};

	this.collapse = function (triggerCallbacks) {
		if (triggerCallbacks == undefined) {
			triggerCallbacks = true;
		}
		const node = this.getCursor();
		if (node.length === 1) {
			if (triggerCallbacks) {
				concordInstance.fireCallback("opCollapse", this.setCursorContext(node));
			}
			node.addClass("collapsed");
			node.find("ol").each(function () {
				if ($(this).children().length > 0) {
					$(this).parent().addClass("collapsed");
				}
			});
			this.markChanged();
		}
	};
	this.copy = function () {
		if (!this.inTextMode()) {
			root.data("clipboard", root.find(".selected").clone(true, true));
		}
	};
	this.countSubs = function () {
		const node = this.getCursor();
		if (node.length === 1) {
			return node.children("ol").children().length;
		}
		return 0;
	};
	this.cursorToXml = function () {
		return concordInstance.editor.opml(this.getCursor());
	};

	this.cursorToXmlSubsOnly = function () { //8/5/13 by DW
		return concordInstance.editor.opml(this.getCursor(), true);
	};

	this.getNodeOpml = function (node) { //3/12/14 by DW
		return concordInstance.editor.opml(node, true);
	};

	this.cut = function () {
		if (!this.inTextMode()) {
			this.copy();
			this.deleteLine();
		}
	};

	this.deleteLine = function () {
		this.saveState();
		if (this.inTextMode()) {
			const cursor = this.getCursor();
			let p = cursor.prev();
			if (p.length === 0) {
				p = cursor.parents(".concord-node:first");
			}
			cursor.remove();
			if (p.length === 1) {
				this.setCursor(p);
			} else {
				if (root.find(".concord-node:first").length === 1) {
					this.setCursor(root.find(".concord-node:first"));
				} else {
					this.wipe();
				}
			}
		} else {
			const selected = root.find(".selected");
			if (selected.length === 1) {
				let p = selected.prev();
				if (p.length === 0) {
					p = selected.parents(".concord-node:first");
				}
				selected.remove();
				if (p.length === 1) {
					this.setCursor(p);
				} else {
					if (root.find(".concord-node:first").length === 1) {
						this.setCursor(root.find(".concord-node:first"));
					} else {
						this.wipe();
					}
				}
			} else if (selected.length > 1) {
				const first = root.find(".selected:first");
				let p = first.prev();
				if (p.length === 0) {
					p = first.parents(".concord-node:first");
				}
				selected.each(function () {
					$(this).remove();
				});
				if (p.length === 1) {
					this.setCursor(p);
				} else {
					if (root.find(".concord-node:first").length === 1) {
						this.setCursor(root.find(".concord-node:first"));
					} else {
						this.wipe();
					}
				}
			}
		}
		if (root.find(".concord-node").length === 0) {
			const node = this.insert("", down);
			this.setCursor(node);
		}
		this.markChanged();
	};
	this.deleteSubs = function () {
		const node = this.getCursor();
		if (node.length === 1) {
			if (node.children("ol").children().length > 0) {
				this.saveState();
				node.children("ol").empty();
			}
		}
		this.markChanged();
	};

	this.demote = function () {
		const node = this.getCursor();
		if (node.nextAll().length > 0) {
			this.saveState();
			node.nextAll().each(function () {
				const sibling = $(this).clone(true, true);
				$(this).remove();
				sibling.appendTo(node.children("ol"));
				node.removeClass("collapsed");
			});
			concordInstance.editor.recalculateLevels(node.find(".concord-node"));
			this.markChanged();
		}
	};

	this.expand = function (triggerCallbacks) {
		if (triggerCallbacks == undefined) {
			triggerCallbacks = true;
		}
		const node = this.getCursor();
		if (node.length === 1) {
			if (triggerCallbacks) {
				concordInstance.fireCallback("opExpand", this.setCursorContext(node));
			}
			if (!node.hasClass("collapsed")) {
				return;
			}
			node.removeClass("collapsed");
			const cursorPosition = node.offset().top;
			const cursorHeight = node.height();
			const windowPosition = $(window).scrollTop();
			const windowHeight = $(window).height();
			const lineHeight = parseInt(node.children(".concord-wrapper").children(".concord-text").css("line-height")) + 6;

			if (flConcordScrollEnabled) { //6/24/14 by DW -- provide a way to disable automatic scrolling
				if (cursorHeight > windowHeight) { //6/24/14 by DW
					const ctscroll = cursorPosition - ctPixelsAboveOutlineArea - lineHeight;
					if (ctscroll > 0) {
						$(window).scrollTop(ctscroll);
					}
				}
				else {
					if ((cursorPosition < windowPosition) || ((cursorPosition + cursorHeight) > (windowPosition + windowHeight))) {
						if (cursorPosition < windowPosition) {
							$(window).scrollTop(cursorPosition);
						} else if ((cursorPosition + cursorHeight) > (windowPosition + windowHeight)) {
							if ((cursorHeight + lineHeight) < windowHeight) {
								$(window).scrollTop(cursorPosition - (windowHeight - cursorHeight) + lineHeight);
							} else {
								$(window).scrollTop(cursorPosition);
							}
						}
					}
				}

			}

			this.markChanged();
		}
	};

	this.expandAllLevels = function () {
		const node = this.getCursor();
		if (node.length === 1) {
			node.removeClass("collapsed");
			node.find(".concord-node").removeClass("collapsed");
		}
	};

	this.focusCursor = function () {
		this.getCursor().children(".concord-wrapper").children(".concord-text").focus();
	};

	this.blurCursor = function () {
		this.getCursor().children(".concord-wrapper").children(".concord-text").blur();
	};

	this.fullCollapse = function () {
		root.find(".concord-node").each(function () {
			if ($(this).children("ol").children().length > 0) {
				$(this).addClass("collapsed");
			}
		});

		const topParent = this.getCursor().parents(".concord-node:last");
		if (topParent.length === 1) {
			concordInstance.editor.select(topParent);
		}
	};

	this.fullExpand = function () {
		root.find(".concord-node").removeClass("collapsed");
	};

	this.getCursor = function () {
		if (_cursor) {
			return _cursor;
		}
		return root.find(".concord-cursor:first");
	};

	this.getCursorRef = function () {
		return this.setCursorContext(this.getCursor());
	};

	this.getHeaders = function () {
		let headers = {};
		if (root.data("head")) {
			headers = root.data("head");
		}
		headers["title"] = this.getTitle();
		return headers;
	};

	this.getLineText = function () {
		const node = this.getCursor();
		if (node.length === 1) {
			let text = node.children(".concord-wrapper:first").children(".concord-text:first").html();
			const textMatches = text.match(/^(.+)<br>\s*$/);
			if (textMatches) {
				text = textMatches[1];
			}
			return concordInstance.editor.unescape(text);
		} else {
			return null;
		}
	};

	this.getRenderMode = function () {
		if (root.data("renderMode") !== undefined) {
			return (root.data("renderMode") === true);
		} else {
			return true;
		}
	};

	this.getTitle = function () {
		return root.data("title");
	};

	this.go = function (direction, count, multiple, textMode) {
		if (count === undefined) {
			count = 1;
		}
		const cursor = this.getCursor();
		if (textMode == undefined) {
			textMode = false;
		}
		this.setTextMode(textMode);
		let ableToMoveInDirection = false;

		let nodeCount = 0;
		switch (direction) {
			case up:
				for (let i = 0; i < count; i++) {
					const prev = cursor.prev();
					if (prev.length === 1) {
						cursor = prev;
						ableToMoveInDirection = true;
					} else {
						break;
					}
				}
				this.setCursor(cursor, multiple);
				break;
			case down:
				for (let i = 0; i < count; i++) {
					const next = cursor.next();
					if (next.length === 1) {
						cursor = next;
						ableToMoveInDirection = true;
					} else {
						break;
					}
				}
				this.setCursor(cursor, multiple);
				break;
			case left:
				for (let i = 0; i < count; i++) {
					const parent = cursor.parents(".concord-node:first");
					if (parent.length === 1) {
						cursor = parent;
						ableToMoveInDirection = true;
					} else {
						break;
					}
				}
				this.setCursor(cursor, multiple);
				break;
			case right:
				for (let i = 0; i < count; i++) {
					const firstSibling = cursor.children("ol").children(".concord-node:first");
					if (firstSibling.length === 1) {
						cursor = firstSibling;
						ableToMoveInDirection = true;
					} else {
						break;
					}
				}
				this.setCursor(cursor, multiple);
				break;
			case flatup:
				nodeCount = 0;
				while (cursor && (nodeCount < count)) {
					const cursor = this._walk_up(cursor);
					if (cursor) {
						if (!cursor.hasClass("collapsed") && (cursor.children("ol").children().length > 0)) {
							nodeCount++;
							ableToMoveInDirection = true;
							if (nodeCount == count) {
								this.setCursor(cursor, multiple);
								break;
							}
						}
					}
				}
				break;
			case flatdown:
				nodeCount = 0;
				while (cursor && (nodeCount < count)) {
					const next = null;
					if (!cursor.hasClass("collapsed")) {
						const outline = cursor.children("ol");
						if (outline.length === 1) {
							const firstChild = outline.children(".concord-node:first");
							if (firstChild.length === 1) {
								next = firstChild;
							}
						}
					}
					if (!next) {
						next = this._walk_down(cursor);
					}
					cursor = next;
					if (cursor) {
						if (!cursor.hasClass("collapsed") && (cursor.children("ol").children().length > 0)) {
							nodeCount++;
							ableToMoveInDirection = true;
							if (nodeCount == count) {
								this.setCursor(cursor, multiple);
							}
						}
					}
				}
				break;
		}
		this.markChanged();
		return ableToMoveInDirection;
	};

	this.insert = function (insertText, insertDirection, flInsertRawHtml) {
		this.saveState();
		const level = this.getCursor().parents(".concord-node").length + 1;
		const node = $("<li></li>");
		node.addClass("concord-node");
		switch (insertDirection) {
			case right:
				level += 1;
				break;
			case left:
				level -= 1;
				break;
		}

		node.addClass("concord-level-" + level);
		const wrapper = $("<div class='concord-wrapper'></div>");
		const iconName = "caret-right";
		const icon = ConcordUtil.getIconHtml(iconName);
		wrapper.append(icon);
		wrapper.addClass("type-icon");

		const text = $("<div class='concord-text' contenteditable='true'></div>");
		text.addClass("concord-level-" + level + "-text");
		const outline = $("<ol></ol>");
		text.appendTo(wrapper);
		wrapper.appendTo(node);
		outline.appendTo(node);

		if (insertText && insertText != "") {
			if (flInsertRawHtml) { //9/16/20 by DW
				text.html(insertText);
			}
			else {
				text.html(concordInstance.editor.escape(insertText));
			}
		}
		const cursor = this.getCursor();
		if (!insertDirection) {
			insertDirection = down;
		}
		switch (insertDirection) {
			case down:
				cursor.after(node);
				break;
			case right:
				cursor.children("ol").prepend(node);
				this.expand(false);
				break;
			case up:
				cursor.before(node);
				break;
			case left:
				const parent = cursor.parents(".concord-node:first");
				if (parent.length === 1) {
					parent.after(node);
				}
				break;
		}
		this.setCursor(node);
		this.markChanged();
		concordInstance.fireCallback("opInsert", this.setCursorContext(node));
		return node;
	};

	this.insertImage = function (url) {
		if (this.inTextMode()) {
			document.execCommand("insertImage", null, url);
		} else {
			this.insert('<img src="' + url + '">', down);
		}
	};

	this.insertText = function (text) {
		let nodes = $("<ol></ol>");
		let lastLevel = 0;
		let startingline = 0;
		const startinglevel = 0;
		let lastNode = null;
		let parent = null;
		let parents = {};
		const lines = text.split("\n");
		let workflowy = true;
		let workflowyParent = null;
		let firstlinewithcontent = 0;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line.match(/^\s*$/)) {
				firstlinewithcontent = i;
				break;
			}
		}

		if (lines.length > (firstlinewithcontent + 2)) {
			if ((lines[firstlinewithcontent].match(/^([\t\s]*)\-.*$/) == null) && lines[firstlinewithcontent].match(/^.+$/) && (lines[firstlinewithcontent + 1] == "")) {
				startingline = firstlinewithcontent + 2;
				workflowyParent = concordInstance.editor.makeNode();
				workflowyParent.children(".concord-wrapper").children(".concord-text").html(lines[firstlinewithcontent]);
			}
		}

		for (let i = startingline; i < lines.length; i++) {
			const line = lines[i];
			if ((line != "") && !line.match(/^\s+$/) && (line.match(/^([\t\s]*)\-.*$/) == null)) {
				workflowy = false;
				break;
			}
		}

		if (!workflowy) {
			startingline = 0;
			workflowyParent = null;
		}

		for (let i = startingline; i < lines.length; i++) {
			const line = lines[i];
			if (line != "" && !line.match(/^\s+$/)) {
				const matches = line.match(/^([\t\s]*)(.+)$/);
				const node = concordInstance.editor.makeNode();
				let nodeText = concordInstance.editor.escape(matches[2]);

				if (workflowy) {
					const nodeTextMatches = nodeText.match(/^([\t\s]*)\-\s*(.+)$/);

					if (nodeTextMatches != null) {
						nodeText = nodeTextMatches[2];
					}
				}

				node.children(".concord-wrapper").children(".concord-text").html(nodeText);
				const level = startinglevel;

				if (matches[1]) {
					if (workflowy) {
						level = (matches[1].length / 2) + startinglevel;
					} else {
						level = matches[1].length + startinglevel;
					}

					if (level > lastLevel) {
						parents[lastLevel] = lastNode;
						parent = lastNode;
					} else if ((level > 0) && (level < lastLevel)) {
						parent = parents[level - 1];
					}
				}

				if (parent && (level > 0)) {
					parent.children("ol").append(node);
					parent.addClass("collapsed");
				} else {
					parents = {};
					nodes.append(node);
				}

				lastNode = node;
				lastLevel = level;
			}
		}

		if (workflowyParent) {
			if (nodes.children().length > 0) {
				workflowyParent.addClass("collapsed");
			}
			const clonedNodes = nodes.clone();
			clonedNodes.children().appendTo(workflowyParent.children("ol"));
			nodes = $("<ol></ol>");
			nodes.append(workflowyParent);
		}

		if (nodes.children().length > 0) {
			this.saveState();
			this.setTextMode(false);
			const cursor = this.getCursor();
			nodes.children().insertAfter(cursor);
			this.setCursor(cursor.next());
			concordInstance.root.removeData("clipboard");
			this.markChanged();
			concordInstance.editor.recalculateLevels();
		}
	};
	this.insertXml = function (opmltext, dir) {
		this.saveState();
		const doc = null;
		const nodes = $("<ol></ol>");
		const cursor = this.getCursor();
		const level = cursor.parents(".concord-node").length + 1;
		if (!dir) {
			dir = down;
		}
		switch (dir) {
			case right:
				level += 1;
				break;
			case left:
				level -= 1;
				break;
		}
		if (typeof opmltext == "string") {
			doc = $($.parseXML(opmltext));
		} else {
			doc = $(opmltext);
		}
		doc.find("body").children("outline").each(function () {
			nodes.append(concordInstance.editor.build($(this), true, level));
		});
		const expansionState = doc.find("expansionState");
		if (expansionState && expansionState.text() && (expansionState.text() != "")) {
			const expansionStates = expansionState.text().split(",");
			const nodeId = 1;
			nodes.find(".concord-node").each(function () {
				if (expansionStates.indexOf("" + nodeId) >= 0) {
					$(this).removeClass("collapsed");
				}
				nodeId++;
			});
		}

		switch (dir) {
			case down:
				nodes.children().insertAfter(cursor);
				break;
			case right:
				nodes.children().prependTo(cursor.children("ol"));
				this.expand(false);
				break;
			case up:
				nodes.children().insertBefore(cursor);
				break;
			case left:
				const parent = cursor.parents(".concord-node:first");
				if (parent.length === 1) {
					nodes.children().insertAfter(parent);
				}
				break;
		}
		this.markChanged();
		return true;
	};

	this.inTextMode = function () {
		return root.hasClass("textMode");
	};
	this.italic = function () {
		this.saveState();
		if (this.inTextMode()) {
			document.execCommand("italic");
		} else {
			this.focusCursor();
			document.execCommand("selectAll");
			document.execCommand("italic");
			document.execCommand("unselect");
			this.blurCursor();
			concordInstance.pasteBinFocus();
		}
		this.markChanged();
	};
	this.level = function () {
		return this.getCursor().parents(".concord-node").length + 1;
	};
	this.link = function (url) {
		if (this.inTextMode()) {
			if (!concord.handleEvents) {
				const instance = this;
				concord.onResume(function () {
					instance.link(url);
				});
				return;
			}
			const range = concordInstance.editor.getSelection();
			if (range === undefined) {
				concordInstance.editor.restoreSelection();
			}
			if (concordInstance.editor.getSelection()) {
				this.saveState();
				document.execCommand("createLink", null, url);
				this.markChanged();
			}
		}
	};
	this.markChanged = function () {
		root.data("changed", true);
		if (!this.inTextMode()) {
			root.find(".concord-node.dirty").removeClass("dirty");
		}
		return true;
	};
	this.paste = function () {
		if (!this.inTextMode()) {
			if (root.data("clipboard") != null) {
				const pasteNodes = root.data("clipboard").clone(true, true);
				if (pasteNodes.length > 0) {
					this.saveState();
					root.find(".selected").removeClass("selected");
					pasteNodes.insertAfter(this.getCursor());
					this.setCursor($(pasteNodes[0]), (pasteNodes.length > 1));
					this.markChanged();
				}
			}
		}
	};
	this.promote = function () {
		const node = this.getCursor();
		if (node.children("ol").children().length > 0) {
			this.saveState();
			node.children("ol").children().reverse().each(function () {
				const child = $(this).clone(true, true);
				$(this).remove();
				node.after(child);
			});
			concordInstance.editor.recalculateLevels(node.parent().find(".concord-node"));
			this.markChanged();
		}
	};

	this.redraw = function () {
		const ct = 1;
		const cursorIndex = 1;
		const wasChanged = this.changed();
		root.find(".concord-node:visible").each(function () {
			if ($(this).hasClass("concord-cursor")) {
				cursorIndex = ct;
				return false;
			}
			ct++;
		});
		this.xmlToOutline(this.outlineToXml());
		ct = 1;
		const thisOp = this;
		root.find(".concord-node:visible").each(function () {
			if (cursorIndex == ct) {
				thisOp.setCursor($(this));
				return false;
			}
			ct++;
		});
		if (wasChanged) {
			this.markChanged();
		}
	};

	this.reorg = function (direction, count) {
		if (count === undefined) {
			count = 1;
		}

		let ableToMoveInDirection = false;
		let cursor = this.getCursor();

		let toMove = this.getCursor();
		const selected = root.find(".selected");
		let iteration = 1;
		if (selected.length > 1) {
			cursor = root.find(".selected:first");
			toMove = root.find(".selected");
		}
		let prev;
		switch (direction) {
			case up:
				prev = cursor.prev();
				if (prev.length === 1) {
					while (iteration < count) {
						if (prev.prev().length === 1) {
							prev = prev.prev();
						} else {
							break;
						}
						iteration++;
					}
					this.saveState();
					const clonedMove = toMove.clone(true, true);
					toMove.remove();
					clonedMove.insertBefore(prev);
					ableToMoveInDirection = true;
				}
				break;
			case down:
				if (!this.inTextMode()) {
					cursor = root.find(".selected:last");
				}
				let next = cursor.next();
				if (next.length === 1) {
					while (iteration < count) {
						if (next.next().length === 1) {
							next = next.next();
						}
						else {
							break;
						}
						iteration++;
					}
					this.saveState();
					const clonedMove = toMove.clone(true, true);
					toMove.remove();
					clonedMove.insertAfter(next);
					ableToMoveInDirection = true;
				}
				break;
			case left:
				const outline = cursor.parent();
				if (!outline.hasClass("concord-root")) {
					let parent = outline.parent();
					while (iteration < count) {
						const parentParent = parent.parents(".concord-node:first");
						if (parentParent.length === 1) {
							parent = parentParent;
						}
						else {
							break;
						}
						iteration++;
					}
					this.saveState();
					const clonedMove = toMove.clone(true, true);
					toMove.remove();
					clonedMove.insertAfter(parent);
					concordInstance.editor.recalculateLevels(parent.nextAll(".concord-node"));
					ableToMoveInDirection = true;
				}
				break;
			case right:
				prev = cursor.prev();
				if (prev.length === 1) {
					this.saveState();
					while (iteration < count) {
						if (prev.children("ol").length === 1) {
							const prevNode = prev.children("ol").children(".concord-node:last");
							if (prevNode.length === 1) {
								prev = prevNode;
							}
							else {
								break;
							}
						}
						else {
							break;
						}
						iteration++;
					}
					const prevOutline = prev.children("ol");
					if (prevOutline.length === 0) {
						prevOutline = $("<ol></ol>");
						prevOutline.appendTo(prev);
					}
					const clonedMove = toMove.clone(true, true);
					toMove.remove();
					clonedMove.appendTo(prevOutline);
					prev.removeClass("collapsed");
					concordInstance.editor.recalculateLevels(prev.find(".concord-node"));
					ableToMoveInDirection = true;
				}
				break;
		}
		if (ableToMoveInDirection) {
			if (this.inTextMode()) {
				this.setCursor(this.getCursor());
			}
			this.markChanged();
			const node = this.getCursor(); //5/9/21 by DW
			concordInstance.fireCallback("opReorg", this.setCursorContext(node)); //5/9/21 by DW
		}
		return ableToMoveInDirection;
	};

	this.runSelection = function () {
		const value = eval(this.getLineText());
		this.deleteSubs();
		this.insert(value, "right");
		concordInstance.script.makeComment();
		this.go("left", 1);
	};

	this.saveState = function () {
		root.data("change", root.children().clone(true, true));
		root.data("changeTextMode", this.inTextMode());
		if (this.inTextMode()) {
			const range = concordInstance.editor.getSelection();
			if (range) {
				root.data("changeRange", range.cloneRange());
			} else {
				root.data("changeRange", undefined);
			}
		} else {
			root.data("changeRange", undefined);
		}
		return true;
	};

	this.setCursor = function (node, multiple, multipleRange) {
		root.find(".concord-cursor").removeClass("concord-cursor");
		node.addClass("concord-cursor");
		if (this.inTextMode()) {
			concordInstance.editor.edit(node);
		} else {
			concordInstance.editor.select(node, multiple, multipleRange);
			concordInstance.pasteBinFocus();
		}
		concordInstance.fireCallback("opCursorMoved", this.setCursorContext(node));
		concordInstance.editor.hideContextMenu();
	};

	this.setCursorContext = function (cursor) {
		return new ConcordOp(root, concordInstance, cursor);
	};

	this.setHeaders = function (headers) {
		root.data("head", headers);
		this.markChanged();
	};
	this.setLineText = function (text) {
		this.saveState();
		const node = this.getCursor();
		if (node.length === 1) {
			node.children(".concord-wrapper:first").children(".concord-text:first").html(concordInstance.editor.escape(text));
			return true;
		} else {
			return false;
		}
		this.markChanged();
	};

	this.setRenderMode = function (mode) {
		root.data("renderMode", mode);
		this.redraw();
		return true;
	};

	this.setStyle = function (css) {
		root.parent().find("style.customStyle").remove();
		root.before('<style type="text/css" class="customStyle">' + css + '</style>');
		return true;
	};

	this.setTextMode = function (textMode) {
		const readonly = concordInstance.prefs()["readonly"];
		if (readonly == undefined) {
			readonly = false;
		}
		if (readonly) {
			return;
		}
		if (root.hasClass("textMode") == textMode) {
			return;
		}
		if (textMode) {
			root.addClass("textMode");
			concordInstance.editor.editorMode();
			concordInstance.editor.edit(this.getCursor());
		} else {
			root.removeClass("textMode");
			root.find(".editing").removeClass("editing");
			this.blurCursor();
			concordInstance.editor.select(this.getCursor());
		}
	};

	this.setTitle = function (title) {
		root.data("title", title);
		return true;
	};

	this.strikethrough = function () {
		this.saveState();
		if (this.inTextMode()) {
			document.execCommand("strikeThrough");
		} else {
			this.focusCursor();
			document.execCommand("selectAll");
			document.execCommand("strikeThrough");
			document.execCommand("unselect");
			this.blurCursor();
			concordInstance.pasteBinFocus();
		}
		this.markChanged();
	};

	this.subsExpanded = function () {
		const node = this.getCursor();
		if (node.length === 1) {
			if (!node.hasClass("collapsed") && (node.children("ol").children().length > 0)) {
				return true;
			} else {
				return false;
			}
		}
		return false;
	};

	this.outlineToText = function () {
		let text = "";
		root.children(".concord-node").each(function () {
			text += concordInstance.editor.textLine($(this));
		});
		return text;
	};

	this.saveCursor = function () {
		let cursor = this.getCursor(), ct = 0;
		let prev;
		while (true) {
			prev = this._walk_up(cursor);
			if (prev) {
				cursor = prev;
				ct++;
			}
			else {
				break;
			}
		}
		return (ct);
	}

	this.sort = function () { //3/7/20 by DW -- sort the list containing the bar cursor headline
		this.saveState();
		const mycursor = this.getCursor();
		const parentnode = $(mycursor).parent();
		const items = $(parentnode).children();
		items.sort(function (a, b) {
			const keyA = $(a).text().toLowerCase();
			const keyB = $(b).text().toLowerCase();
			if (keyA < keyB) return -1;
			if (keyA > keyB) return 1;
			return 0;
		});
		$.each(items, function (i, li) {
			parentnode.append(li); //removes it from the old spot and moves it
		});
		this.markChanged();
	}
	this.outlineToXml = function (ownerName, ownerEmail, ownerId) {
		const head = this.getHeaders();
		if (ownerName) {
			head["ownerName"] = ownerName;
		}
		if (ownerEmail) {
			head["ownerEmail"] = ownerEmail;
		}
		if (ownerId) {
			head["ownerId"] = ownerId;
		}

		let title = this.getTitle();
		if (!title) {
			title = "";
		}
		head["title"] = title;

		head["dateModified"] = (new Date()).toGMTString();
		const expansionStates = [];
		let nodeId = 1;
		let cursor = root.find(".concord-node:first");
		do {
			if (cursor) {
				if (!cursor.hasClass("collapsed") && (cursor.children("ol").children().length > 0)) {
					expansionStates.push(nodeId);
				}
				nodeId++;
			} else {
				break;
			}
			let next = null;
			if (!cursor.hasClass("collapsed")) {
				const outline = cursor.children("ol");
				if (outline.length === 1) {
					const firstChild = outline.children(".concord-node:first");
					if (firstChild.length === 1) {
						next = firstChild;
					}
				}
			}
			if (!next) {
				next = this._walk_down(cursor);
			}
			cursor = next;
		} while (cursor != null);

		head["expansionState"] = expansionStates.join(",");

		head["lastCursor"] = this.saveCursor(); //8/5/14 by DW

		let opml = '';
		let indent = 0;
		const add = function (s) {
			for (let i = 0; i < indent; i++) {
				opml += '\t';
			}
			opml += s + '\n';
		};
		add('<?xml version="1.0"?>');
		add('<opml version="2.0">');
		indent++;
		add('<head>');
		indent++;
		for (let headName in head) {
			if (head[headName] !== undefined) {
				add('<' + headName + '>' + ConcordUtil.escapeXml(head[headName]) + '</' + headName + '>');
			}
		}
		add('</head>');
		indent--;
		add('<body>');
		indent++;
		root.children(".concord-node").each(function () {
			opml += concordInstance.editor.opmlLine($(this), indent);
		});
		add('</body>');
		indent--;
		add('</opml>');
		return opml;
	};
	this.undo = function () {
		const stateBeforeChange = root.children().clone(true, true);
		const textModeBeforeChange = this.inTextMode();
		const beforeRange = undefined;
		if (this.inTextMode()) {
			const range = concordInstance.editor.getSelection();
			if (range) {
				beforeRange = range.cloneRange();
			}
		}
		if (root.data("change")) {
			root.empty();
			root.data("change").appendTo(root);
			this.setTextMode(root.data("changeTextMode"));
			if (this.inTextMode()) {
				this.focusCursor();
				const range = root.data("changeRange");
				if (range) {
					concordInstance.editor.restoreSelection(range);
				}
			}
			root.data("change", stateBeforeChange);
			root.data("changeTextMode", textModeBeforeChange);
			root.data("changeRange", beforeRange);
			return true;
		}
		return false;
	};
	this.visitLevel = function (cb) {
		const cursor = this.getCursor();
		const op = this;
		cursor.children("ol").children().each(function () {
			const subCursorContext = op.setCursorContext($(this));
			cb(subCursorContext);
		});
		return true;
	};
	this.visitToSummit = function (cb) {
		const cursor = this.getCursor();
		while (cb(this.setCursorContext(cursor))) {
			const parent = cursor.parents(".concord-node:first");
			if (parent.length === 1) {
				cursor = parent;
			} else {
				break;
			}
		}
		return true;
	};
	this.visitAll = function (cb) {
		const op = this;
		root.find(".concord-node").each(function () {
			const subCursorContext = op.setCursorContext($(this));
			const retVal = cb(subCursorContext);
			if ((retVal !== undefined) && (retVal === false)) {
				return false;
			}
		});
	};

	this.wipe = function () {
		if (root.find(".concord-node").length > 0) {
			this.saveState();
		}
		root.empty();
		const node = concordInstance.editor.makeNode();
		root.append(node);
		this.setTextMode(false);
		this.setCursor(node);
		this.markChanged();
	};

	this.xmlToOutline = function (xmlText, flSetFocus, flInsertRawHtml) {
		if (flSetFocus == undefined) {
			flSetFocus = true;
		}

		let doc = $(xmlText);
		if (typeof xmlText == "string") {
			doc = $($.parseXML(xmlText));
		}

		root.empty();
		let title = "";
		if (doc.find("title:first").length === 1) {
			title = doc.find("title:first").text();
		}
		this.setTitle(title);
		const headers = {};
		doc.find("head").children().each(function () {
			headers[$(this).prop("tagName")] = $(this).text();
		});
		root.data("head", headers);
		doc.find("body").children("outline").each(function () {
			root.append(concordInstance.editor.build($(this), true, undefined, flInsertRawHtml)); //9/18/20 by DW -- pass new flInsertRawHtml param
		});
		root.data("changed", false);
		root.removeData("previousChange");
		const expansionState = doc.find("expansionState");
		let next;

		if (expansionState && expansionState.text() && (expansionState.text() != "")) {
			const expansionStates = expansionState.text().split(/\s*,\s*/);
			let nodeId = 1;
			let cursor = root.find(".concord-node:first");
			do {
				if (cursor) {
					if (expansionStates.indexOf("" + nodeId) >= 0) {
						cursor.removeClass("collapsed");
					}
					nodeId++;
				} else {
					break;
				}

				next = null;
				if (!cursor.hasClass("collapsed")) {
					const outline = cursor.children("ol");
					if (outline.length === 1) {
						const firstChild = outline.children(".concord-node:first");
						if (firstChild.length === 1) {
							next = firstChild;
						}
					}
				}
				if (!next) {
					next = this._walk_down(cursor);
				}
				cursor = next;
			} while (cursor != null);
		}
		this.setTextMode(false);

		if (flSetFocus) {
			const lastCursor = doc.find("lastCursor"); //8/5/14 by DW
			this.setCursor(root.find(".concord-node:first"));
			if (lastCursor && lastCursor.text() && (lastCursor.text() != "")) { //8/5/14 by DW
				const ix = parseInt(lastCursor.text());
				if (ix != NaN) {
					let cursor = this.getCursor(), flCursorMoved = false;
					for (let i = 1; i <= ix; i++) {
						next = null;
						if (!cursor) { //1/15/24 by DW
							return;
						}
						if (!cursor.hasClass("collapsed")) {
							const outline = cursor.children("ol");
							if (outline.length === 1) {
								const firstChild = outline.children(".concord-node:first");
								if (firstChild.length === 1) {
									next = firstChild;
								}
							}
						}
						if (!next) {
							next = this._walk_down(cursor);
						}
						cursor = next;
						flCursorMoved = true;
					}
					if (flCursorMoved) {
						this.setCursor(next);
					}
				}
			}
		}

		root.data("currentChange", root.children().clone(true, true));
		return true;
	};
	this.attributes = new ConcordOpAttributes(concordInstance, this.getCursor());
}
function ConcordOpAttributes(concordInstance, cursor) {
	this._cssTextClassName = "cssTextClass";
	this._cssTextClass = function (newValue) {
		if (newValue === undefined) {
			return;
		}
		const newCssClasses = newValue.split(/\s+/);
		const concordText = cursor.children(".concord-wrapper:first").children(".concord-text:first");
		const currentCssClass = concordText.attr("class");
		if (currentCssClass) {
			const cssClassesArray = currentCssClass.split(/\s+/);
			for (let i in cssClassesArray) {
				const className = cssClassesArray[i];
				if (className.match(/^concord\-.+$/) == null) {
					concordText.removeClass(className);
				}
			}
		}
		for (let j in newCssClasses) {
			const newClass = newCssClasses[j];
			concordText.addClass(newClass);
		}
	};
	this.addGroup = function (attributes) {
		if (attributes["type"]) {
			cursor.attr("opml-type", attributes["type"]);
		}
		else {
			cursor.removeAttr("opml-type");
		}
		this._cssTextClass(attributes[this._cssTextClassName]);
		const finalAttributes = this.getAll();
		const iconAttribute = "type";
		if (attributes["icon"]) {
			iconAttribute = "icon";
		}
		for (let name in attributes) {
			finalAttributes[name] = attributes[name];
			if (name == iconAttribute) {
				const value = attributes[name];
				const wrapper = cursor.children(".concord-wrapper");
				const iconName = null;
				if ((name == "type") && concordInstance.prefs() && concordInstance.prefs().typeIcons && concordInstance.prefs().typeIcons[value]) {
					iconName = concordInstance.prefs().typeIcons[value];
				} else if (name == "icon") {
					iconName = value;
				}
				if (iconName) {
					const icon = ConcordUtil.getIconHtml(iconName);
					wrapper.children(".node-icon:first").replaceWith(icon);
				}
			}
		}
		cursor.data("attributes", finalAttributes);
		concordInstance.op.markChanged();
		return finalAttributes;
	};
	this.setGroup = function (attributes) {
		if (attributes[this._cssTextClassName] !== undefined) {
			this._cssTextClass(attributes[this._cssTextClassName]);
		}
		else {
			this._cssTextClass("");
		}
		cursor.data("attributes", attributes);
		let wrapper = cursor.children(".concord-wrapper");
		$(cursor[0].attributes).each(function () {
			const matches = this.name.match(/^opml-(.+)$/)
			if (matches) {
				const name = matches[1];
				if (!attributes[name]) {
					cursor.removeAttr(this.name);
				}
			}
		});
		const iconAttribute = "type";
		if (attributes["icon"]) {
			iconAttribute = "icon";
		}
		if (name == "type") {
			cursor.attr("opml-" + name, attributes[name]);
		}
		for (let name in attributes) {
			if (name == iconAttribute) {
				const value = attributes[name];
				wrapper = cursor.children(".concord-wrapper");
				const iconName = null;
				if ((name == "type") && concordInstance.prefs() && concordInstance.prefs().typeIcons && concordInstance.prefs().typeIcons[value]) {
					iconName = concordInstance.prefs().typeIcons[value];
				} else if (name == "icon") {
					iconName = value;
				}
				if (iconName) {
					const icon = ConcordUtil.getIconHtml(iconName);
					wrapper.children(".node-icon:first").replaceWith(icon);
				}
			}
		}
		concordInstance.op.markChanged();
		return attributes;
	};
	this.getAll = function () {
		if (cursor.data("attributes") !== undefined) {
			return cursor.data("attributes");
		}
		return {};
	};
	this.getOne = function (name) {
		return this.getAll()[name];
	};
	this.makeEmpty = function () {
		this._cssTextClass("");
		const numAttributes = 0;
		const atts = this.getAll();
		if (atts !== undefined) {
			for (let i in atts) {
				numAttributes++;
			}
		}
		cursor.removeData("attributes");
		const removedAnyAttributes = (numAttributes > 0);
		const attributes = {};
		$(cursor[0].attributes).each(function () {
			const matches = this.name.match(/^opml-(.+)$/)
			if (matches) {
				cursor.removeAttr(this.name);
			}
		});
		if (removedAnyAttributes) {
			concordInstance.op.markChanged();
		}
		return removedAnyAttributes;
	};
	this.setOne = function (name, value) {
		if (name == this._cssTextClassName) {
			this._cssTextClass(value);
		}
		const atts = this.getAll();
		atts[name] = value;
		cursor.data("attributes", atts);
		if ((name == "type") || (name == "icon")) {
			cursor.attr("opml-" + name, value);
			const wrapper = cursor.children(".concord-wrapper");
			const iconName = null;
			if ((name == "type") && concordInstance.prefs() && concordInstance.prefs().typeIcons && concordInstance.prefs().typeIcons[value]) {
				iconName = concordInstance.prefs().typeIcons[value];
			} else if (name == "icon") {
				iconName = value;
			}
			if (iconName) {
				const icon = ConcordUtil.getIconHtml(iconName);
				wrapper.children(".node-icon:first").replaceWith(icon);
			}
		}
		concordInstance.op.markChanged();
		return true;
	};
	this.exists = function (name) {
		if (this.getOne(name) !== undefined) {
			return true;
		} else {
			return false;
		}
	};
	this.removeOne = function (name) {
		if (this.getAll()[name]) {
			if (name == this._cssTextClassName) {
				this._cssTextClass("");
			}
			delete this.getAll()[name];
			concordInstance.op.markChanged();
			return true;
		}
		return false;
	};
}
function ConcordScript(root, concordInstance) {
	this.isComment = function () {
		if (concordInstance.op.attributes.getOne("isComment") !== undefined) {
			return concordInstance.op.attributes.getOne("isComment") == "true";
		}
		let parentIsAComment = false;
		concordInstance.op.getCursor().parents(".concord-node").each(function () {
			if (concordInstance.op.setCursorContext($(this)).attributes.getOne("isComment") == "true") {
				parentIsAComment = true;
				return;
			}
		});
		return parentIsAComment;
	};
	this.makeComment = function () {
		concordInstance.op.attributes.setOne("isComment", "true");
		concordInstance.op.getCursor().addClass("concord-comment");
		return true;
	};
	this.unComment = function () {
		concordInstance.op.attributes.setOne("isComment", "false");
		concordInstance.op.getCursor().removeClass("concord-comment");
		return true;
	};
}
function Op(opmltext) {
	const fakeDom = $("<div></div>");
	fakeDom.concord().op.xmlToOutline(opmltext);
	return fakeDom.concord().op;
}
(function ($) {
	$.fn.concord = function (options) {
		return new ConcordOutline($(this), options);
	};
	$(document).on("keydown", function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if ($(event.target).is("input") || $(event.target).is("textarea")) {
			return;
		}
		const focusRoot = concord.getFocusRoot();
		if (focusRoot == null) {
			return;
		}
		const context = focusRoot;
		context.data("keydownEvent", event);
		const concordInstance = new ConcordOutline(context.parent());
		const readonly = concordInstance.prefs()["readonly"];
		if (readonly == undefined) {
			readonly = false;
		}
		// Readonly exceptions for arrow keys and cmd-comma
		if (readonly) {
			if ((event.which >= 37) && (event.which <= 40)) {
				readonly = false;
			}
			else if ((event.metaKey || event.ctrlKey) && (event.which === 188)) {
				readonly = false;
			}
		}
		if (!readonly) {
			const keystrokeString = ConcordUtil.getKeystroke(event);
			event.concord = { //2/17/20 by DW
				keystrokeString,
				flKeyCaptured: false
			};
			concordInstance.fireCallback("opKeystroke", event);
			let keyCaptured = event.concord.flKeyCaptured;
			const commandKey = event.metaKey || event.ctrlKey;
			let active;
			switch (keystrokeString) {
				case "backspace":
					if (concord.mobile) {
						if ((concordInstance.op.getLineText() == "") || (concordInstance.op.getLineText() == "<br>")) {
							event.preventDefault();
							concordInstance.op.deleteLine();
						}
					}
					else {
						if (concordInstance.op.inTextMode()) {
							if (!concordInstance.op.getCursor().hasClass("dirty")) {
								concordInstance.op.saveState();
								concordInstance.op.getCursor().addClass("dirty");
							}
						} else {
							keyCaptured = true;
							event.preventDefault();
							concordInstance.op.deleteLine();
						}
					}
					break;
				case "meta-backspace": //cmd-backspace -- 2/6/20 by DW
					function cmdBackspace() {
						const rightstring = concordInstance.op.getLineText();
						if (concordInstance.op.countSubs() > 0) { //has subs
							return (false);
						}
						if (!concordInstance.op.go(up, 1)) { //it's the first line at the level, nothing to merge with
							return (false);
						}
						if (concordInstance.op.countSubs() > 0) { //has subs
							concordInstance.op.go(down, 1);
							return (false);
						}
						concordInstance.op.setLineText(concordInstance.op.getLineText() + rightstring);
						concordInstance.op.go(down, 1)
						concordInstance.op.deleteLine(); //moves cursor up before deleting
						return (true);
					}
					if (!cmdBackspace()) {
						ConcordUtil.speakerBeep();
					}
					break;
				case "tab":
					keyCaptured = true;
					event.preventDefault();
					event.stopPropagation();
					if (event.shiftKey) {
						concordInstance.op.reorg(left)
					} else {
						concordInstance.op.reorg(right);
					}
					break;
				case "select-all":
					keyCaptured = true;
					event.preventDefault();
					const cursor = concordInstance.op.getCursor();
					if (concordInstance.op.inTextMode()) {
						concordInstance.op.focusCursor();
						document.execCommand('selectAll', false, null);
					} else {
						concordInstance.editor.selectionMode();
						cursor.parent().children().addClass("selected");
					}
					break;
				case "reorg-up":
					keyCaptured = true;
					event.preventDefault();
					concordInstance.op.reorg(up);
					break;
				case "reorg-down":
					keyCaptured = true;
					event.preventDefault();
					concordInstance.op.reorg(down);
					break;
				case "reorg-left":
					keyCaptured = true;
					event.preventDefault();
					concordInstance.op.reorg(left);
					break;
				case "reorg-right":
					keyCaptured = true;
					event.preventDefault();
					concordInstance.op.reorg(right);
					break;
				case "promote":
					keyCaptured = true;
					event.preventDefault();
					concordInstance.op.promote();
					break;
				case "demote":
					keyCaptured = true;
					event.preventDefault();
					concordInstance.op.demote();
					break;
				case "return":
					if (concord.mobile) {
						//Mobile
						event.preventDefault();
						keyCaptured = true;
						const cursor = concordInstance.op.getCursor();
						const clonedCursor = cursor.clone(true, true);
						clonedCursor.removeClass("concord-cursor");
						cursor.removeClass("selected");
						cursor.removeClass("dirty");
						cursor.removeClass("collapsed");
						concordInstance.op.setLineText("");
						const icon = ConcordUtil.getIconHtml("caret-right");
						cursor.children(".concord-wrapper").children(".node-icon").replaceWith(icon);
						clonedCursor.insertBefore(cursor);
						concordInstance.op.attributes.makeEmpty();
						concordInstance.op.deleteSubs();
						concordInstance.op.focusCursor();
						concordInstance.fireCallback("opInsert", concordInstance.op.setCursorContext(cursor));
					}
					else {
						event.preventDefault();
						keyCaptured = true;
						if (event.originalEvent && ((event.originalEvent.keyLocation && (event.originalEvent.keyLocation != 0)) || (event.originalEvent.location && (event.originalEvent.location != 0)))) {
							concordInstance.op.setTextMode(!concordInstance.op.inTextMode());
						} else {
							let direction = down;
							if (concordInstance.op.subsExpanded()) {
								direction = right;
							}
							concordInstance.op.insert("", direction);
							concordInstance.op.setTextMode(true);
							concordInstance.op.focusCursor();
						}
					}
					break;
				case "meta-return": //cmd-return -- 2/6/20 by DW
					if (concordInstance.op.inTextMode()) {
						if (concordInstance.op.countSubs() === 0) { //no subs
							function getCaretPosition(node) {
								const range = window.getSelection().getRangeAt(0);
								const preCaretRange = range.cloneRange();
								let caretPosition;
								const tmp = document.createElement("div");
								preCaretRange.selectNodeContents(node);
								preCaretRange.setEnd(range.endContainer, range.endOffset);
								tmp.appendChild(preCaretRange.cloneContents());
								caretPosition = tmp.innerHTML.length;
								return caretPosition;
							}
							const text = concordInstance.op.getCursor().children(".concord-wrapper:first").children(".concord-text:first");
							const ixcaret = getCaretPosition(text.get(0));
							const linetext = concordInstance.op.getLineText();
							const leftstring = ConcordUtil.stringMid(linetext, 1, ixcaret);
							const rightstring = ConcordUtil.stringDelete(linetext, 1, ixcaret);
							concordInstance.op.setLineText(leftstring);
							concordInstance.op.insert(rightstring, down);
						}
						else {
							console.log("Can't split this headline because it has subs.");
							ConcordUtil.speakerBeep();
						}
					}
					else {
						console.log("Can't split this headline because you're not in text mode.");
						ConcordUtil.speakerBeep();
					}
					break;
				case "cursor-left":
					active = false;
					if ($(event.target).hasClass("concord-text")) {
						if (event.target.selectionStart > 0) {
							active = false;
						}
					}
					if (context.find(".concord-cursor.selected").length === 1) {
						active = true;
					}
					if (active) {
						keyCaptured = true;
						event.preventDefault();
						const cursor = concordInstance.op.getCursor();
						const prev = concordInstance.op._walk_up(cursor);
						if (prev) {
							concordInstance.op.setCursor(prev);
						}
					}
					break;
				case "cursor-up":
					keyCaptured = true;
					event.preventDefault();
					if (concordInstance.op.inTextMode()) {
						const cursor = concordInstance.op.getCursor();
						const prev = concordInstance.op._walk_up(cursor);
						if (prev) {
							concordInstance.op.setCursor(prev);
						}
					} else {
						concordInstance.op.go(up, 1, event.shiftKey, concordInstance.op.inTextMode());
					}
					break;
				case "cursor-right":
					active = false;
					if (context.find(".concord-cursor.selected").length === 1) {
						active = true;
					}

					if (active) {
						keyCaptured = true;
						event.preventDefault();

						let next = null;
						const cursor = concordInstance.op.getCursor();
						if (!cursor.hasClass("collapsed")) {
							const outline = cursor.children("ol");
							if (outline.length === 1) {
								const firstChild = outline.children(".concord-node:first");
								if (firstChild.length === 1) {
									next = firstChild;
								}
							}
						}

						if (!next) {
							next = concordInstance.op._walk_down(cursor);
						}
						if (next) {
							concordInstance.op.setCursor(next);
						}
					}
					break;
				case "cursor-down":
					keyCaptured = true;
					event.preventDefault();

					if (concordInstance.op.inTextMode()) {
						let next = null;
						const cursor = concordInstance.op.getCursor();
						if (!cursor.hasClass("collapsed")) {
							const outline = cursor.children("ol");
							if (outline.length === 1) {
								const firstChild = outline.children(".concord-node:first");
								if (firstChild.length === 1) {
									next = firstChild;
								}
							}
						}
						if (!next) {
							next = concordInstance.op._walk_down(cursor);
						}
						if (next) {
							concordInstance.op.setCursor(next);
						}
					} else {
						concordInstance.op.go(down, 1, event.shiftKey, concordInstance.op.inTextMode());
					}
					break;
				case "delete":
					if (concordInstance.op.inTextMode()) {
						if (!concordInstance.op.getCursor().hasClass("dirty")) {
							concordInstance.op.saveState();
							concordInstance.op.getCursor().addClass("dirty");
						}
					} else {
						keyCaptured = true;
						event.preventDefault();
						concordInstance.op.deleteLine();
					}
					break;
				case "undo":
					keyCaptured = true;
					event.preventDefault();
					concordInstance.op.undo();
					break;
				case "cut":
					if (concordInstance.op.inTextMode()) {
						if (concordInstance.op.getLineText() == "") {
							keyCaptured = true;
							event.preventDefault();
							concordInstance.op.deleteLine();
						}
						else {
							concordInstance.op.saveState();
						}
					}
					break;
				case "copy": //problem!
					if (false && commandKey) {
						if (concordInstance.op.inTextMode()) {
							if (concordInstance.op.getLineText() != "") {
								concordInstance.root.removeData("clipboard");
							}
						} else {
							keyCaptured = true;
							event.preventDefault();
							concordInstance.op.copy();
						}
					}
					break;
				case "paste": //problem!
					break;
				case "toggle-comment":
					if (concordInstance.script.isComment()) {
						concordInstance.script.unComment();
					} else {
						concordInstance.script.makeComment();
					}
					break;
				case "italicize":
					keyCaptured = true;
					event.preventDefault();
					concordInstance.op.italic();
					break;
				case "bolden":
					keyCaptured = true;
					event.preventDefault();
					concordInstance.op.bold();
					break;
				case "toggle-render":
					keyCaptured = true;
					event.preventDefault();
					concordInstance.op.setRenderMode(!concordInstance.op.getRenderMode());
					break;
				case "toggle-expand":
					keyCaptured = true;
					event.preventDefault();
					if (concordInstance.op.subsExpanded()) {
						concordInstance.op.collapse();
					} else {
						concordInstance.op.expand();
					}
					break;
				case "run-selection":
					if (!keyCaptured) { //2/19/21 by DW
						keyCaptured = true;
						event.preventDefault();
						concordInstance.op.runSelection();
					}
					break;
				default:
					keyCaptured = false;
			}
			if (!keyCaptured) {
				if (event.which >= 32 && (event.which < 112 || event.which > 123) && event.which < 1000 && !commandKey) {
					const node = concordInstance.op.getCursor();
					if (concordInstance.op.inTextMode()) {
						if (!node.hasClass("dirty")) {
							concordInstance.op.saveState();
						}
						node.addClass("dirty");
					} else {
						concordInstance.op.setTextMode(true);
						concordInstance.op.saveState();
						concordInstance.editor.edit(node, true);
						node.addClass("dirty");
					}
					concordInstance.op.markChanged();
				}
			}
		}
	});
	$(document).on("mouseup", function (event) {
		if (!concord.handleEvents) {
			return;
		}
		if ($(".concord-root").length === 0) {
			return;
		}
		if ($(event.target).is("a") || $(event.target).is("input") || $(event.target).is("textarea") || ($(event.target).parents("a:first").length === 1) || $(event.target).hasClass("dropdown-menu") || ($(event.target).parents(".dropdown-menu:first").length > 0)) {
			return;
		}
		const context = $(event.target).parents(".concord-root:first");
		if (context.length === 0) {
			$(".concord-root").each(function () {
				const concordInstance = new ConcordOutline($(this).parent());
				concordInstance.editor.hideContextMenu();
				concordInstance.editor.dragModeExit();
			});
			const focusRoot = concord.getFocusRoot();
		}
	});
	$(document).on("click", concord.updateFocusRootEvent);
	$(document).on("dblclick", concord.updateFocusRootEvent);
	$(document).on('show', function (e) {
		if ($(e.target).is(".modal")) {
			if ($(e.target).attr("concord-events") != "true") {
				concord.stopListening();
			}
		}
	});
	$(document).on('hidden', function (e) {
		if ($(e.target).is(".modal")) {
			if ($(e.target).attr("concord-events") != "true") {
				concord.resumeListening();
			}
		}
	});
	concord.ready = true;
})(jQuery);
