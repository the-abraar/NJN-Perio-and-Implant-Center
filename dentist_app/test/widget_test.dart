import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:njn_dentist_app/main.dart';

void main() {
  testWidgets('DetailRow shows label and value', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: DetailRow(label: 'Patient', value: 'Rahim')),
    ));

    expect(find.text('Patient'), findsOneWidget);
    expect(find.text('Rahim'), findsOneWidget);
  });

  test('slotDocId is keyed by the slot start time', () {
    final slot = DateTime.utc(2026, 10, 30, 17);
    expect(slotDocId(slot), 'slot_${slot.millisecondsSinceEpoch}');
  });
}
