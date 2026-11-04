# HeizCheck FAQ und Richtlinien

Hier finden Sie Antworten auf häufige Fragen zu Datenspeicherung, Datenschutz, Zugriffsrechten und den Grenzen von HeizCheck.

## Datenspeicherung und Löschfristen

Wie lange speichert HeizCheck meine Daten? Hochgeladene PDFs, Abrechnungspakete und Prüfberichte werden 4 Jahre aufbewahrt und danach automatisch gelöscht.

Die 4 Jahre rechnen ab dem Zeitpunkt, an dem das jeweilige Paket hochgeladen beziehungsweise der Prüfbericht erstellt wurde. Ein Paket wird erst gelöscht, wenn es und sein Prüfbericht beide mindestens 4 Jahre alt sind.

Warum gerade 4 Jahre? Die Frist deckt die 12-monatige Einwendungsfrist der Mieter nach §556 Abs. 3 BGB und die anschließende 3-jährige Verjährungsfrist nach §195 BGB ab. So haben Sie Ihre Belege, solange Sie sie brauchen, ohne Daten länger als nötig zu halten.

Ein Paket, das vor 4 Jahren hochgeladen wurde, ist abgelaufen und kann nicht mehr geprüft werden. Ersetzte Pakete und ihre Prüfberichte werden nicht vorzeitig gelöscht; für sie gilt dieselbe Frist. Prüfberichte werden ausschließlich durch diese automatische Löschung entfernt.

## Datenschutz und KI-Verarbeitung

Wo werden meine Daten gespeichert? Alle Daten liegen in der EU. Die Datenbank und die hochgeladenen PDFs liegen bei Supabase in Frankfurt, die Anwendung läuft bei Vercel in der EU-Region.

Werden meine Daten an eine KI geschickt? Ja. Um die Zahlen aus den PDFs auszulesen, schickt HeizCheck die PDFs an das KI-Modell Claude Sonnet 5 von Anthropic. Im Betrieb geschieht das über Amazon Bedrock in der AWS-Region eu-west-1 in Irland. Die Verarbeitung bleibt so in einer einzigen EU-Region. Bevor echte Abrechnungen verarbeitet werden, wird die Datenaufbewahrung bei Bedrock abgeschaltet (Einstellung „none“), sodass Bedrock keine Anfragen speichert. Anthropic hat bei Bedrock keinen Zugriff auf die Anfragen und Antworten, und Ihre Daten werden nicht zum Training von KI-Modellen verwendet.

Die KI liest nur Zahlen aus. Sie beurteilt nicht, ob eine Abrechnung richtig ist; das tun die festen Prüfregeln.

Gibt es einen Auftragsverarbeitungsvertrag? Ja. Für jede Organisation steht ein AV-Vertrag zur Verfügung. Er nennt AWS in der Region eu-west-1 (Irland) als Ort der Verarbeitung für das Auslesen der Zahlen.

## Wer sieht welche Daten?

HeizCheck ist nach Organisationen getrennt. Eine Organisation ist eine Hausverwaltung, die HeizCheck nutzt. Sie sehen alle Gebäude, Abrechnungspakete und Prüfberichte Ihrer Organisation und nichts von anderen Organisationen.

Alle Nutzer einer Organisation haben die gleichen Rechte. Es gibt keine Rollen. Sie können Kolleginnen und Kollegen in Ihre Organisation einladen, damit das Team die Prüfarbeit teilen kann.

Mieter sind keine Nutzer von HeizCheck. Sie erhalten ihre Einzelabrechnung wie gewohnt von Ihnen, nicht über HeizCheck.

## Was HeizCheck nicht tut

HeizCheck ist für die Mietverwaltung gebaut. Die Verwaltung von Wohnungseigentümergemeinschaften (WEG-Verwaltung) wird nicht unterstützt: Dort gelten andere rechtliche Beziehungen, und die Kosten werden über die Jahresabrechnung auf Eigentümer verteilt statt auf Mieter. Eine Unterstützung für WEG ist für später geplant.

HeizCheck prüft keine gemischt genutzten oder gewerblichen Gebäude, keine Gebäude ohne Zentralheizung und keine Gebäude mit weniger als 3 Nutzeinheiten.

Das Regelwerk umfasst die HeizkostenV, beim §556 BGB nur die 12-Monats-Frist, und das CO2KostAufG. Das Gebäudeenergiegesetz (GEG) wird nicht geprüft. Auch die monatliche Verbrauchsinformation nach §6a HeizkostenV ist nicht Teil der Prüfung.

HeizCheck vergleicht nicht mit dem Vorjahr oder mit ähnlichen Nutzeinheiten. Es erstellt keine Reklamation an den Messdienstleister und kein Erklärschreiben für Mieter. HeizCheck korrigiert keine Abrechnungen; es zeigt, was falsch ist, und Sie entscheiden, was zu tun ist.

HeizCheck ist keine Rechtsberatung. Es liefert eine belegbasierte Prüfung, aber keine Garantie für rechtliche Richtigkeit.

Getestet ist HeizCheck mit Abrechnungen von Minol. Abrechnungen anderer Messdienstleister wie ista, Techem oder Brunata werden noch nicht unterstützt.
