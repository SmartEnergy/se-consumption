/*
 Smart Energy (Uni Bremen)
 http://smartenergy.uni-bremen.de/
 dSS Consumption
 2011-2012 by Philip Häusler <msquare@notrademark.de>
 
 Hauptlogik
 */

// Wenn die Seite geladen ist die Initialisierung starten.
$(function() {
	dssc.init();
});

// Das dssc (dss-consumption) Objekt, es enthält alle Werte und Funktionen, die
// als Model und Controller dienen
var dssc = {
	token : null, // dSS Authentifizierungstoken
	circuits : [], // Stromkreise mit dSM dSID und Namen
	circuits_selected : [], // Stromkreise, deren Werte angezeigt werden sollen
	unit : "Wh", // Einheit in der die Daten angezeigt werden
	power_price : null,
	interval_mode : "Woche", // Intervall das angezeigt wird
	compare_mode : false,
	compare_interval : 0, // Intervall mit dem verglichen werden soll
	date : new Date(), // Aktueller zu zeigender Zeitpunkt, anhand dessen das
	// zu zeigende Intervall ermittelt wird.
	dateString : "",
	// Anwendung starten
	init : function() {
		dssc.login();
		dssc.updateDate();
		dssc.updateIntervals();
		dssc.updateUnits();
	},
	// Verbrauchswerte anhand der Einstellungen neu laden und den Graphen
	// zeichnen
	updateGraph : function() {
		gui.modal(true);
		var interval = dssc.getDateInterval();
		var series = [];
		var series_meta = [];
		var sum = 0;

		// Wenn mehr als 1 dsM ausgewählt ist, wird eine Gesamtlinie
		// eingeblendet
		if (dssc.circuits_selected.length > 1) {
			series[0] = [];
			if (dssc.compare_mode)
				series[1] = [];
		}

		// Legende für die Gesamtserie
		if (dssc.circuits_selected.length > 1) {
			if (dssc.compare_mode) {
				series_meta[0] = {
					label : dssc.dateString + " Gesamt",
					showLabel : true,
					lineWidth : 3,
					showMarker : false,
					shadow : false
				};
				series_meta[1] = {
					label : dssc.compareDateString + " Gesamt",
					showLabel : true,
					lineWidth : 3,
					showMarker : false,
					shadow : false
				};
			} else {
				series_meta[0] = {
					label : "Gesamt",
					showLabel : true,
					lineWidth : 3,
					showMarker : false,
					shadow : false
				};
			}
		}

		// Alle Metering/Seriendaten per AJAX laden und vorbereiten
		for ( var i = 0; i < dssc.circuits_selected.length; i++) {
			sum += dssc.makeSeries(interval, series, i, 0);

			if (dssc.compare_mode) {
				var compareInterval = dssc.getDateInterval(new Date(dssc.date
						- -dssc.compare_interval));
				dssc.makeSeries(compareInterval, series, i, 1);
			}

			// Legenden für die Serien
			for ( var j = 0; j < dssc.circuits.length; j++)
				if (dssc.circuits[j].dsid == dssc.circuits_selected[i]) {
					if (dssc.compare_mode) {
						series_meta[series_meta.length] = {
							label : dssc.dateString + " "
									+ dssc.circuits[j].name,
							showLabel : true,
							lineWidth : 2,
							showMarker : false,
							shadow : false
						};
						series_meta[series_meta.length] = {
							label : dssc.compareDateString + " "
									+ dssc.circuits[j].name,
							showLabel : true,
							lineWidth : 2,
							showMarker : false,
							shadow : false
						};
					} else {
						series_meta[series_meta.length] = {
							label : dssc.circuits[j].name,
							showLabel : true,
							lineWidth : 2,
							showMarker : false,
							shadow : false
						};
					}
					break;
				}
		}
		if (series.length == 0)
			series = [ [ 0, 0 ] ];

		// Graph zurücksetzen
		$("#plot").html("");

		// Graph neuzeichnen
		$.jqplot('plot', series, {
			title : dssc.getLabel(),
			axes : {
				xaxis : {
					renderer : $.jqplot.DateAxisRenderer,
					tickOptions : {
						formatString : dssc.getDateFormatString()
					},
					min : interval.start.getFullYear() + "-"
							+ (interval.start.getMonth() + 1) + "-"
							+ interval.start.getDate(),
					max : interval.end.getFullYear() + "-"
							+ (interval.end.getMonth() + 1) + "-"
							+ interval.end.getDate(),
					tickInterval : dssc.getTickInterval()
				},
				yaxis : {
					label : dssc.unit == "Wh" ? "Wh" : "€"
				}
			},
			series : series_meta,
			legend : {
				show : true,
				location : 'nw'
			},
			grid : {
				background : '#fff',
				shadow : false
			}
		});

		// Gesamtverbrauch anzeigen:
		if (dssc.unit == "Wh")
			$("#consumption_sum").html(gui.whFormat(sum));
		else
			$("#consumption_sum").html(gui.euroFormat(sum * 100));

		gui.modal(false);
	},

	// Holt die Daten einer Serie vom Server und berechnet die Graph-Serien
	// daraus
	makeSeries : function(interval, series, i, gesamtOffset) {
		var sum = 0;
		var query = '/json/metering/getValues?dsid='
				+ dssc.circuits_selected[i] + '&type=energyDelta&resolution='
				+ dssc.getResolution() + '&startTime='
				+ interval.start.getTime() / 1000 + '&endTime='
				+ interval.end.getTime() / 1000;
		$
				.ajax({
					url : query,
					dataType : 'json',
					async : false,
					success : function(data) {
						if (data.result == null) {
							gui.modal(false);
							return;
						}

						// Serien ggf. auf Euro umrechnen
						if (dssc.unit == "Euro") {
							for ( var j = 0; j < data.result.values.length; j++) {
								data.result.values[j][1] = data.result.values[j][1]
										* dssc.power_price / 1000 / 100;
							}
						}

						// Gesamt-Werte initialisieren
						if (dssc.circuits_selected.length > 1 && i == 0)
							for ( var j = 0; j < data.result.values.length; j++) {
								var timestamp = new Date(
										data.result.values[j][0]
												* 1000
												+ (gesamtOffset == 1 ? -dssc.compare_interval
														: 0));
								if (timestamp > new Date().getTime())
									continue;
								series[gesamtOffset][j] = [
										timestamp.getFullYear() + "-"
												+ (timestamp.getMonth() + 1)
												+ "-" + timestamp.getDate()
												+ " " + timestamp.getHours()
												+ ":" + timestamp.getMinutes(),
										0 ];
							}

						// Wertereihen durchgehen und Werte initialisieren
						// (und auf Gesamtwert aufrechnen)
						for ( var j = 0; j < data.result.values.length; j++) {
							var timestamp = new Date(
									data.result.values[j][0]
											* 1000
											+ (gesamtOffset == 1 ? -dssc.compare_interval
													: 0));
							if (timestamp > new Date().getTime())
								continue;

							if (dssc.circuits_selected.length > 1)
								series[gesamtOffset][j][1] += data.result.values[j][1];

							data.result.values[j][0] = timestamp.getFullYear()
									+ "-" + (timestamp.getMonth() + 1) + "-"
									+ timestamp.getDate() + " "
									+ timestamp.getHours() + ":"
									+ timestamp.getMinutes();
							sum += data.result.values[j][1];
						}
						series[series.length] = data.result.values;
					}
				});
		return sum;
	},

	// Berechnet das Label für den Graphen
	getLabel : function() {
		if (dssc.compare_mode)
			return "Vergleich von " + dssc.dateString + " mit "
					+ dssc.compareDateString;
		return dssc.dateString;
	},

	// String mit dem das Datum in den Axen formatiert wird
	getDateFormatString : function() {
		if (dssc.interval_mode == "Tag")
			return '%H:%M';
		else if (dssc.interval_mode == "Woche")
			return '%a';
		else if (dssc.interval_mode == "Monat")
			return '%d.%m.';
		else if (dssc.interval_mode == "Jahr")
			return '%b';
	},
	// Übersetzt das Intervall für jqplot
	getTickInterval : function() {
		if (dssc.interval_mode == "Tag")
			return '1 hour';
		else if (dssc.interval_mode == "Woche")
			return '1 day';
		else if (dssc.interval_mode == "Monat")
			return '1 day';
		else if (dssc.interval_mode == "Jahr")
			return '1 month';
	},
	// Übersetzt das Intervall in die Zeitabstände der Metering Werte
	getResolution : function() {
		if (dssc.interval_mode == "Tag")
			return 900;
		else if (dssc.interval_mode == "Woche")
			return 86400;
		else if (dssc.interval_mode == "Monat")
			return 86400;
		else if (dssc.interval_mode == "Jahr")
			return 604800;
	},
	// Ein Authentifizierungstoekn organisieren
	login : function() {
		$.getJSON('/json/system/login?fuser=dssadmin&password=dssadmin',
				function(data) {
					dssc.token = data.result.token;
					dssc.findSeries();
				});
	},
	// Ermitteln, zu welchen dSMs auch Werte vorhanden sind
	findSeries : function() {
		gui.modal(true);
		$.getJSON('/json/metering/getSeries', function(data) {
			for ( var i = 0; i < data.result.series.length; i++) {
				if (data.result.series[i].type == "energy") {
					var index = dssc.circuits.length;
					dssc.circuits[index] = {
						"dsid" : data.result.series[i].dsid,
						"name" : data.result.series[i].dsid
					};
					$.ajax({
						url : '/json/circuit/getName?id='
								+ data.result.series[i].dsid,
						dataType : 'json',
						async : false,
						success : function(data) {
							dssc.circuits[index].name = data.result.name;
							dssc.updateCircuits();
						}
					});
				}
			}
			if (dssc.circuits_selected.length == 0)
				for ( var i = 0; i < dssc.circuits.length; i++)
					dssc.circuits_selected[i] = dssc.circuits[i].dsid;
			dssc.updateCircuits();
			gui.modal(false);
		});
	},
	// Namen der Stromkreise laden und eintragen
	updateCircuits : function() {
		var buttons = [];
		for ( var i = 0; i < dssc.circuits.length; i++) {
			buttons[buttons.length] = gui
					.button(
							dssc.circuits[i].name,
							function(ev) {
								var dsid = this.getAttribute('data');
								var index = dssc.circuits_selected
										.indexOf(dsid);
								if (index >= 0)
									dssc.circuits_selected.splice(index, 1);
								else
									dssc.circuits_selected[dssc.circuits_selected.length] = dsid;
								dssc.updateCircuits();
								return false;
							}, $.inArray(dssc.circuits[i].dsid,
									dssc.circuits_selected) >= 0,
							dssc.circuits[i].dsid);
		}
		gui.buttons("circuits", buttons);
		dssc.updateGraph();
	},
	// Berechnet den Intervall-Wechsler
	updateIntervals : function() {
		gui.buttons("intervals", [ gui.button("Tag", function() {
			dssc.selectInterval("Tag");
			return false;
		}, dssc.interval_mode == "Tag"), gui.button("Woche", function() {
			dssc.selectInterval("Woche");
			return false;
		}, dssc.interval_mode == "Woche"), gui.button("Monat", function() {
			dssc.selectInterval("Monat");
			return false;
		}, dssc.interval_mode == "Monat"), gui.button("Jahr", function() {
			dssc.selectInterval("Jahr");
			return false;
		}, dssc.interval_mode == "Jahr") ]);
	},
	// Eventhandler beim Ändern des Intervalls
	selectInterval : function(interval) {
		dssc.interval_mode = interval;
		dssc.updateIntervals();
		dssc.updateDate();
	},
	// Berechnet den Einheiten-Wechsler
	updateUnits : function() {
		gui.buttons("units", [
				gui.button("Wh", function() {
					dssc.setUnit("Wh");
					return false;
				}, dssc.unit == "Wh"),
				gui.button("€", function() {
					dssc.setUnit("Euro");
					return false;
				}, dssc.unit == "Euro"),
				gui.label("Gesamt: <span id=\"consumption_sum\"></span>"),
				dssc.unit == "Euro" ? gui.editableLabel("power_price",
						"Preis:", dssc.power_price, "Cent / kWh", /^[0-9]+$/,
						function(newPrice) {
							dssc.power_price = newPrice;
							$.getJSON(
									'/json/property/setInteger?value='
											+ newPrice
											+ '&path=/apartment/power_price',
									function(data) {
										dssc.updateGraph();
									});
						}) : "" ]);
	},
	// Ändert die Einheit der Darstellung
	setUnit : function(unit) {
		dssc.unit = unit;
		if (dssc.power_price == null)
			$.getJSON('/json/property/getInteger?path=/apartment/power_price',
					function(data) {
						if (data.ok) {
							dssc.power_price = data.result.value;
							dssc.updateUnits();
							dssc.updateGraph();
						}
					});

		dssc.updateUnits();
		dssc.updateGraph();
	},
	// Berechnet den Datums-Wechsler
	updateDate : function() {
		var dateInterval = dssc.getDateInterval();
		dateInterval.end = new Date(dateInterval.end - 1);
		dssc.dateString = gui.dateFormat(dateInterval.start) + " - "
				+ gui.dateFormat(dateInterval.end);
		var buttons = [ gui.button("<", dssc.dateBackward, false),
				gui.button(dssc.dateString, function() {
					dssc.date = new Date();
					dssc.updateDate();
					return false;
				}, false), gui.button(">", dssc.dateForward, false) ];
		buttons = buttons.concat([ gui.button("Vergleich"
				+ (dssc.compare_mode ? " mit:" : ""), dssc.toggleCompareMode,
				dssc.compare_mode) ]);
		if (dssc.compare_mode) {
			var dateInterval = dssc.getDateInterval(new Date(dssc.date
					- -dssc.compare_interval));
			dateInterval.end = new Date(dateInterval.end - 1);
			dssc.compareDateString = gui.dateFormat(dateInterval.start) + " - "
					+ gui.dateFormat(dateInterval.end);

			buttons = buttons
					.concat([ gui.button("<", dssc.compareDateBackward, false),
							gui.button(dssc.compareDateString, function() {
								dssc.compare_interval = -dssc.getInterval();
								dssc.updateDate();
								return false;
							}, false),
							gui.button(">", dssc.compareDateForward, false) ]);
		}
		gui.buttons("date", buttons);
		dssc.updateGraph();
	},
	// Vergleichs-Modus an oder ausschalten
	toggleCompareMode : function() {
		dssc.compare_mode = !dssc.compare_mode;
		if (dssc.compare_interval == 0)
			dssc.compare_interval -= dssc.getInterval();

		dssc.updateDate();
		return false;
	},
	// Vergleichs-Intervall in die Zukunft schieben
	compareDateForward : function() {
		dssc.compare_interval -= -dssc.getInterval();
		dssc.updateDate();
		return false;
	},
	// Vergleichs-Intervall in die Vergangenheit schieben
	compareDateBackward : function() {
		dssc.compare_interval -= dssc.getInterval();
		dssc.updateDate();
		return false;
	},
	// Um ein Intervall in die Zukunft springen
	dateForward : function() {
		dssc.date = new Date(dssc.date - -dssc.getInterval());
		dssc.updateDate();
		return false;
	},
	// Um ein Intervall in die Vergangenheit springen
	dateBackward : function() {
		dssc.date = new Date(dssc.date - dssc.getInterval());
		dssc.updateDate();
		return false;
	},
	// Länge des eingestellten Intervalls in Millisekunden
	getInterval : function() {
		if (dssc.interval_mode == "Tag")
			return 24 * 60 * 60 * 1000;
		else if (dssc.interval_mode == "Woche")
			return 7 * 24 * 60 * 60 * 1000;
		else if (dssc.interval_mode == "Monat")
			return 31 * 24 * 60 * 60 * 1000;
		else if (dssc.interval_mode == "Jahr")
			return 365 * 24 * 60 * 60 * 1000;
	},
	// Start und Ende des Intervalls als Javascript Datums-Objekt
	getDateInterval : function(date) {
		var d = (date == null) ? dssc.date : date;
		var start = null;
		var end = null;
		if (dssc.interval_mode == "Tag") {
			start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0,
					0);
			end = new Date(start - -24 * 60 * 60 * 1000);
		} else if (dssc.interval_mode == "Woche") {
			start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0,
					0);
			// Montag berechnen
			start = new Date(start - (start.getDay() + 6) % 7 * 24 * 60 * 60
					* 1000);
			end = new Date(start - -7 * 24 * 60 * 60 * 1000);
		} else if (dssc.interval_mode == "Monat") {
			start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
			end = new Date(start - -31 * 24 * 60 * 60 * 1000);
			end.setDate(1);
		} else if (dssc.interval_mode == "Jahr") {
			start = new Date(d.getFullYear(), 0, 1, 0, 0, 0);
			end = new Date(d.getFullYear() + 1, 0, 1, 0, 0, 0);
		}
		return {
			"start" : start,
			"end" : end
		};
	}
};