# HeizCheck Handbuch

Dieses Handbuch erklärt, wie Sie mit HeizCheck Heizkostenabrechnungen prüfen, bevor Sie sie an Ihre Mieter weitergeben. Die Begriffe entsprechen denen in der Anwendung.

## Was ist HeizCheck?

HeizCheck ist eine Qualitätsprüfung für Hausverwaltungen. Ihr Messdienstleister, zum Beispiel Minol, erstellt für jedes Gebäude die Heizkostenabrechnung. Bevor Sie die Einzelabrechnungen an die Mieter versenden, lädt Ihre Hausverwaltung das Abrechnungspaket in HeizCheck hoch und erhält einen Prüfbericht.

Der Prüfbericht zeigt jeden Befund mit dem zugehörigen Paragraphen, den betroffenen Nutzeinheiten und dem Euro-Betrag, um den es geht. So können Sie jede Abrechnung gegenüber Mietern begründen und eine Reklamation beim Messdienstleister mit Belegen untermauern.

HeizCheck liefert eine belegbasierte Prüfung, aber keine Garantie für rechtliche Richtigkeit. Darauf weist ein Hinweis in der Anwendung und im exportierten Prüfbericht hin.

Die KI in HeizCheck liest nur die Zahlen aus den PDFs aus. Ob etwas falsch ist, entscheiden feste Prüfregeln, die immer gleich rechnen. Jeder Befund lässt sich so auf einen Paragraphen zurückführen.

Geprüft werden Wohngebäude mit Zentralheizung und mindestens 3 Nutzeinheiten. Getestet ist HeizCheck mit Abrechnungen von Minol. Die Oberfläche ist auf Deutsch.

## Gebäude anlegen

Legen Sie zuerst ein Gebäude mit seiner Adresse an. Abrechnungspakete werden immer einem Gebäude zugeordnet.

Zu jedem Gebäude gehört ein Gebäudeprofil. Es enthält Angaben, die der Messdienstleister nicht liefert, die die Prüfregeln aber brauchen:

- die Wohnfläche, aus der die CO2-Intensität berechnet wird,
- die beheizte Fläche, mit der die Flächen der Einzelabrechnungen verglichen werden,
- ob §7 Abs. 1 Satz 2 HeizkostenV gilt, also ein Verbrauchsanteil von genau 70 % vorgeschrieben ist,
- ob das Gebäude ein Wohngebäude ist,
- ob das Gebäude unter Denkmalschutz steht oder an Fernwärme angeschlossen sein muss (§9 CO2KostAufG).

Das Gebäudeprofil enthält die wahren Werte. Die Abrechnung enthält nur, was der Messdienstleister behauptet. Sie pflegen das Gebäudeprofil einmal und verwenden es für alle Abrechnungszeiträume weiter. Sie können es jederzeit ändern; bereits erstellte Prüfberichte bleiben dabei unverändert.

Gebäude, die HeizCheck nicht abdeckt, werden abgelehnt: Gebäude, die keine Wohngebäude sind, Gebäude ohne Zentralheizung und Gebäude mit weniger als 3 Nutzeinheiten.

## Abrechnungspaket hochladen

Ein Abrechnungspaket besteht aus der Gesamtabrechnung des Gebäudes und allen Einzelabrechnungen der Nutzeinheiten für einen Abrechnungszeitraum. Laden Sie alle PDFs eines Gebäudes für einen Abrechnungszeitraum zusammen hoch, damit das ganze Paket gemeinsam geprüft wird.

Geben Sie beim Hochladen das Versanddatum an, also den Tag, an dem Sie die Einzelabrechnungen an die Mieter schicken oder schicken wollen. Es ist mit dem heutigen Datum vorbelegt. HeizCheck prüft damit die Abrechnungsfrist nach §556 Abs. 3 BGB.

Ist eine Datei kein lesbares PDF, erhalten Sie eine Meldung und können die richtige Datei hochladen. Während die KI die Zahlen ausliest, sehen Sie den Fortschritt. Schlägt das Auslesen fehl, wird Ihnen das klar angezeigt, und Sie können es erneut versuchen, ohne erneut hochzuladen.

## Ausgelesene Zahlen bestätigen

Die KI liest aus der Gesamtabrechnung die Gesamtkosten je Kostenposition, die Aufteilung in Verbrauchs- und Grundkosten in Prozent, die Gesamtfläche, den Brennstoff und den CO2-Ausstoß. Aus jeder Einzelabrechnung liest sie Nutzeinheit, Fläche, Verbrauch, Betrag, Abrechnungszeitraum und ob Werte geschätzt wurden. Findet die KI eine Zahl nicht, bleibt das Feld leer, statt geraten zu werden.

Auf einem einzigen Bestätigungsbildschirm sehen Sie jede Zahl neben der Stelle im PDF, an der sie steht. Die Einzelabrechnungen erscheinen als Tabelle. Sie können jede Zahl korrigieren und leere Felder ausfüllen. Danach bestätigen Sie einmal für das ganze Paket.

Bestätigte Zahlen sind danach gesperrt. Nur sie fließen in die Prüfregeln ein. Fehlen im Gebäudeprofil Angaben, werden Sie aufgefordert, sie zu ergänzen, damit weniger Regeln „nicht prüfbar“ ergeben.

## Den Prüfbericht lesen

Nach dem Bestätigen läuft die Prüfung automatisch, und Sie erhalten den Prüfbericht. Er enthält für jede Regel genau ein Prüfergebnis: bestanden, Befund oder nicht prüfbar. Bei „nicht prüfbar“ steht der Grund dabei, zum Beispiel fehlende Angaben im Gebäudeprofil. So sehen Sie, was geprüft wurde, und nicht nur, was falsch ist.

Jeder Befund hat einen Schweregrad. Ein Fehler ist ein eindeutiger Verstoß. Ein Prüfhinweis ist rechtlich möglich, verlangt aber Ihre Einschätzung. Eine reine Information gibt es nicht. Jeder Befund nennt außerdem seinen Paragraphen, die betroffenen Nutzeinheiten und, wo er sich beziffern lässt, den Euro-Betrag, um den es geht.

Die Ergebnisse sind nach Regeln gruppiert: zuerst Regeln mit einem Fehler, dann Regeln mit nur Prüfhinweisen, dann nicht prüfbare Regeln, zuletzt bestandene Regeln. Innerhalb einer Regel stehen Fehler vor Prüfhinweisen.

Der Prüfbericht ist unveränderlich. Er hält die bestätigten Zahlen, das Gebäudeprofil, die Adresse des Gebäudes und die Version des Regelwerks fest, auf denen er beruht. Sie können ihn als PDF exportieren, ablegen oder an den Messdienstleister schicken. Das PDF enthält den Hinweis, dass HeizCheck keine Garantie für rechtliche Richtigkeit gibt.

## Prüfregel C1: Beträge ergeben die Gesamtsumme

C1 prüft, ob die Beträge aller Einzelabrechnungen zusammen die Gesamtsumme der Gesamtabrechnung ergeben. Erlaubt ist eine Abweichung von höchstens 0,05 € je Nutzeinheit. Eine größere Abweichung ist ein Fehler; der Betrag, um den es geht, ist die Differenz.

## Prüfregel C2: Flächen ergeben die beheizte Fläche

C2 prüft, ob die Flächen der Einzelabrechnungen zusammen die beheizte Fläche aus dem Gebäudeprofil ergeben. Die Toleranz richtet sich danach, wie genau die Flächen gedruckt sind: (Anzahl Nutzeinheiten + 1) × die Hälfte der kleinsten gedruckten Stufe. Rundungen in der Abrechnung lösen so keinen Fehlalarm aus. Fehlt die beheizte Fläche, ist C2 nicht prüfbar.

## Prüfregel C3: Einheitlicher Abrechnungszeitraum

C3 prüft, ob alle Einzelabrechnungen denselben Abrechnungszeitraum haben wie die Gesamtabrechnung. Abweichende Einzelabrechnungen werden als betroffene Nutzeinheiten genannt.

## Prüfregel H1: Verbrauchsanteil Heizung

H1 prüft nach §7 HeizkostenV, ob der Verbrauchsanteil der Heizkosten zwischen 50 % und 70 % liegt. Gilt laut Gebäudeprofil §7 Abs. 1 Satz 2 HeizkostenV, muss er genau 70 % betragen. Ist diese Angabe im Gebäudeprofil offen, gibt H1 zusätzlich einen Prüfhinweis, dass genau 70 % vorgeschrieben sein könnten, etwa bei älteren Öl- und Gasheizungen.

## Prüfregel H2: Verbrauchsanteil Warmwasser

H2 prüft nach §8 HeizkostenV, ob der Verbrauchsanteil der Warmwasserkosten zwischen 50 % und 70 % liegt. Enthält das Paket keine zentrale Warmwasserversorgung, ist H2 nicht prüfbar.

## Prüfregel H3: Umlagefähige Kostenarten

H3 prüft nach §7 Abs. 2 HeizkostenV jede Kostenposition der Gesamtabrechnung. Jede Position muss einer umlagefähigen Kostenart entsprechen. Nicht umlagefähige Positionen sind ein Fehler, unbekannte Positionen ergeben einen Prüfhinweis. Die KI übernimmt die Namen der Kostenpositionen genau so, wie Minol sie schreibt; die Regel ordnet sie über eine feste Tabelle zu.

## Prüfregel H4: Geschätzte Werte über 25 %

H4 prüft nach §9a Abs. 2 HeizkostenV: Wurden für mehr als 25 % der Fläche Werte geschätzt, darf nur noch nach Fläche abgerechnet werden. Rechnet die Abrechnung trotzdem nach Verbrauch ab, ist das ein Fehler.

## Prüfregel H5: Geschätzte Werte

H5 gibt nach §9a Abs. 1 HeizkostenV einen Prüfhinweis, sobald für irgendeine Nutzeinheit Werte geschätzt wurden, und nennt diese Nutzeinheiten. So können Sie prüfen, ob die Schätzungen berechtigt sind.

## Prüfregel K1: CO2-Kostenaufteilung

K1 prüft nach dem CO2KostAufG, ob die Aufteilung der CO2-Kosten zwischen Vermieter und Mieter zur Stufe des Gebäudes passt. Die Stufe ergibt sich aus den kg CO2 pro m² Wohnfläche und Jahr, gerundet auf eine Nachkommastelle. Bei kürzeren Abrechnungszeiträumen werden die Stufengrenzen anteilig gesenkt. Steht das Gebäude laut Gebäudeprofil unter Denkmalschutz oder muss es Fernwärme nutzen, berücksichtigt K1 die Minderung nach §9 CO2KostAufG.

K1 meldet auch, wenn die angegebene Intensität oder Stufe nicht zu den Zahlen passt. K1 gilt nur für Abrechnungszeiträume, die zwischen dem 1. Januar 2023 und dem 31. Dezember 2027 beginnen. Für andere Zeiträume ist K1 nicht prüfbar.

## Prüfregel K2: CO2-Angaben fehlen

K2 prüft, ob die Abrechnung überhaupt CO2-Angaben enthält. Fehlen sie, gibt K2 einen Prüfhinweis: Der Mieter darf dann seinen Anteil an den Heizkosten um 3 % kürzen (§7 Abs. 3 und 4 CO2KostAufG). Fordern Sie die Angaben vor dem Versand beim Messdienstleister an.

## Prüfregel B1: Abrechnungsfrist nach §556 BGB

B1 prüft die Abrechnungsfrist nach §556 Abs. 3 BGB. Die Frist endet 12 Kalendermonate nach dem Ende des Abrechnungszeitraums, nicht nach 365 Tagen (§188 BGB). Hat der Zielmonat weniger Tage, endet die Frist an seinem letzten Tag: Endet der Abrechnungszeitraum am 28. Februar 2025, endet die Frist am 28. Februar 2026.

Liegt das Versanddatum nach dem Fristende, ist das ein Fehler. Bleiben bis zum Fristende weniger als 4 Wochen (28 Tage), gibt B1 einen Prüfhinweis.

## Neue Version einer Abrechnung

Schickt Ihnen der Messdienstleister eine korrigierte Abrechnung, etwa nach einer Reklamation, laden Sie sie als neues Abrechnungspaket für dasselbe Gebäude und denselben Abrechnungszeitraum hoch.

Sobald Sie die Zahlen des neuen Pakets bestätigen, ersetzt es das bisherige Paket. Das ersetzte Paket und sein Prüfbericht werden nicht gelöscht, sondern bleiben sichtbar. So können Sie zeigen, was ursprünglich falsch war. Bis zur Bestätigung bleibt das bisherige Paket das aktuelle.

Zu jedem Gebäude und Abrechnungszeitraum sehen Sie alle Pakete und Prüfberichte in zeitlicher Reihenfolge, das älteste zuerst. Die Ansicht zeigt standardmäßig das aktuelle Paket und verweist auf den Verlauf.
