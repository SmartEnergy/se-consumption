/*
 Smart Energy (Uni Bremen)
 http://smartenergy.uni-bremen.de/
 dSS Consumption
 2011-2012 by Philip Häusler <msquare@notrademark.de>
 
 GUI Funktionen
 */

var gui = {
	// Zeigt/Versteckt den Ladebalken
	modal : function(state) {
		state ? $("#modal").show() : $("#modal").hide();
	},
	// Baut eine Reihe aus Buttons, Labels und editierbaren Labels
	buttons : function(id, buttons) {
		id = "buttons_" + id;
		if ($("#" + id).size() == 0)
			$("#header").append('<p class="buttons" id="' + id + '"></p>');

		$("#" + id).html("");
		for ( var i = 0; i < buttons.length; i++) {
			if (buttons[i].type == "button") {
				var a = $('<a href="">' + buttons[i].label + '</a>').click(
						buttons[i].callback).appendTo("#" + id);
				a.attr('data', buttons[i].data);
				if (buttons[i].selected)
					a.addClass("selected");
			} else if (buttons[i].type == "label") {
				$('<span class="label">' + buttons[i].label + '</span>')
						.appendTo("#" + id);
			} else if (buttons[i].type == "editable_label") {
				$(
						'<span id="editable_' + buttons[i].id
								+ '" title="Anlicken zum Bearbeiten" class="label">' + buttons[i].label
								+ ' <span id="editable_' + buttons[i].id
								+ '_value" class="editable">' + buttons[i].value
								+ '</span><input id="editable_' + buttons[i].id
								+ '_input" type="text" value="" /> '
								+ buttons[i].unit + '</span>').appendTo(
						"#" + id).click(
						// Bei Click in den Bearbeitungs-Modus wechseln
						function() {
							var id = this.id;
							$("#" + id + "_value").hide();
							$("#" + id + "_input").show().val(
									$("#" + id + "_value").html()).focus()
									.select();
						});
				// Wenn gegebener Wert fehlerhaft ist, dann sofort in den
				// Bearbeitungs-Modus wechseln
				if (buttons[i].value == null
						|| !buttons[i].regex.test(buttons[i].value)) {
					$("#editable_" + buttons[i].id + "_value").html("");
					$("#editable_" + buttons[i].id).click();
				}
				// Beim Editieren live dabei sein:
				var input = $("#editable_" + buttons[i].id + "_input");
				input.keyup({
					"id" : buttons[i].id,
					"regex" : buttons[i].regex,
					"onUpdate" : buttons[i].onUpdate
				}, function(ev) {
					var id = ev.data.id;
					$(this).removeClass("error");
					if (!ev.data.regex.test($(this).val()))
						// Regex passt nicht
						$(this).addClass("error");
					else if (ev.which == 13) {
						// Enter-Taste / Bearbeitung fertig
						$("#editable_" + id + "_input").hide();
						$("#editable_" + id + "_value").show().html(
								$("#editable_" + id + "_input").val());
						ev.data.onUpdate($(this).val());
					}
				});
			}
		}
	},
	// Baut einen Button
	button : function(label, callback, selected, data) {
		return {
			"type" : "button",
			"label" : label,
			"selected" : selected,
			"callback" : callback,
			"data" : data
		};
	},
	// Baut ein Label, das einen Wert anzeigt, den man live editieren kann
	editableLabel : function(id, label, value, unit, regex, onUpdate) {
		return {
			"type" : "editable_label",
			"id" : id,
			"label" : label,
			"value" : value,
			"unit" : unit,
			"regex" : regex,
			"onUpdate" : onUpdate
		};
	},
	// Baut ein Label für "buttons" Reihe
	label : function(label) {
		return {
			"type" : "label",
			"label" : label
		};
	},
	whFormat : function(wh) {
		var unit = "Wh";

		if (wh > 1000) {
			unit = "kWh";
			wh = wh / 1000;
		}

		return wh.toFixed(2) + " " + unit;
	},
	euroFormat : function(cent) {
		var unit = "Cent";

		if (cent > 100) {
			unit = "€";
			cent = cent / 100;
		}

		return cent.toFixed(2) + " " + unit;
	},
	// Baut einen Datumsstring aus einem Javascript Date
	dateFormat : function(date) {
		return date.getFullYear() + "-" + (date.getMonth() < 9 ? "0" : "")
				+ (date.getMonth() + 1) + "-"
				+ (date.getDate() < 10 ? "0" : "") + date.getDate();
	}
};