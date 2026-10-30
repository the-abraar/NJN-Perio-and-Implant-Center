import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'firebase_options.dart';
import 'services/onesignal_service.dart';

const teal = Color(0xFF008080);
const oneSignalAppId = '250e80e8-270a-4b37-8315-f2906460d6a7';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  OneSignalService().initialize(oneSignalAppId);
  runApp(const NJNDentistApp());
}

class NJNDentistApp extends StatelessWidget {
  const NJNDentistApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NJN Dentist',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: teal),
        useMaterial3: true,
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _integrationDialogShown = false;

  @override
  void initState() {
    super.initState();
    _setupPushSubscriptionObserver();
  }

  void _setupPushSubscriptionObserver() {
    final oneSignal = OneSignalService();
    oneSignal.addPushSubscriptionObserver((state) {
      _maybeShowIntegrationCompleteDialog(state.current.id);
    });

    // The subscription ID may already be server-assigned before the
    // observer attaches, so evaluate the current value immediately too.
    _maybeShowIntegrationCompleteDialog(oneSignal.currentPushSubscriptionId);
  }

  bool _isRegistered(String? subscriptionId) =>
      subscriptionId != null && subscriptionId.isNotEmpty && !subscriptionId.startsWith('local-');

  void _maybeShowIntegrationCompleteDialog(String? subscriptionId) {
    if (!_isRegistered(subscriptionId) || _integrationDialogShown) return;
    _integrationDialogShown = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _showIntegrationCompleteDialog();
    });
  }

  void _showIntegrationCompleteDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Your OneSignal SDK integration is complete!'),
        content: const Text(
          'You can now send Push Notifications & In-App Messages through OneSignal. '
          'Tap below to enable push notifications.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              OneSignalService().requestPermission();
            },
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        if (snapshot.hasData) return const PendingRequestsScreen();
        return const LoginScreen();
      },
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
    } catch (exception) {
      setState(() => _error = 'Could not sign in. Check your email and password.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.local_hospital, size: 48, color: teal),
                  const SizedBox(height: 8),
                  Text(
                    'NJN Dentist Sign In',
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.username],
                    decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                    validator: (value) => (value == null || value.trim().isEmpty) ? 'Enter your email' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    autofillHints: const [AutofillHints.password],
                    decoration: const InputDecoration(labelText: 'Password', border: OutlineInputBorder()),
                    validator: (value) => (value == null || value.isEmpty) ? 'Enter your password' : null,
                    onFieldSubmitted: (_) => _signIn(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _isSubmitting ? null : _signIn,
                    child: _isSubmitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Sign In'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class PendingRequestsScreen extends StatelessWidget {
  const PendingRequestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final query = FirebaseFirestore.instance
        .collection('appointments')
        .where('status', isEqualTo: 'pending')
        .orderBy('slotStart');

    return Scaffold(
      appBar: AppBar(title: const Text('Pending Requests')),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: query.snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(child: Text('Could not load requests: ${snapshot.error}'));
          }
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final docs = snapshot.data!.docs;
          if (docs.isEmpty) {
            return const Center(child: Text('No pending appointment requests.'));
          }
          return ListView.separated(
            itemCount: docs.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final appointment = Appointment.fromDoc(docs[index]);
              return ListTile(
                title: Text(appointment.patientName),
                subtitle: Text('${appointment.formattedSlot} • ${appointment.patientPhone}'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => RequestDetailsScreen(appointment: appointment),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

class RequestDetailsScreen extends StatelessWidget {
  const RequestDetailsScreen({required this.appointment, super.key});

  final Appointment appointment;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(appointment.patientName)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DetailRow(label: 'Age', value: '${appointment.patientAge}'),
          DetailRow(label: 'Phone', value: appointment.patientPhone),
          DetailRow(label: 'Requested slot', value: appointment.formattedSlot),
          DetailRow(
            label: 'Problem',
            value: appointment.description.isEmpty ? 'No description provided.' : appointment.description,
          ),
          if (appointment.fileURL != null) ...[
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: InteractiveViewer(
                child: Image.network(appointment.fileURL!, fit: BoxFit.contain),
              ),
            ),
          ],
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: () => _accept(context),
            icon: const Icon(Icons.check),
            label: const Text('Accept and Open SMS'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => _delay(context),
            icon: const Icon(Icons.schedule),
            label: const Text('Delay to Another Slot'),
          ),
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: () => _avoid(context),
            icon: const Icon(Icons.close),
            label: const Text('Avoid Request'),
          ),
        ],
      ),
    );
  }

  Future<void> _accept(BuildContext context) async {
    final message =
        'NJN Perio & Implant: Your appointment on ${appointment.formattedDate} at ${appointment.formattedTime} is confirmed. Thank you.';
    await openSms(appointment.patientPhone, message);
    if (context.mounted) {
      final sent = await confirmSmsSent(context);
      if (sent) {
        await appointment.ref.update({'status': 'booked'});
        await FirebaseFirestore.instance
            .collection('slotStatus')
            .doc(appointment.ref.id)
            .set({'slotStart': Timestamp.fromDate(appointment.slotStart), 'status': 'booked'});
        if (context.mounted) Navigator.of(context).pop();
      }
    }
  }

  Future<void> _delay(BuildContext context) async {
    final pickedDate = await showDatePicker(
      context: context,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 30)),
      initialDate: appointment.slotStart.add(const Duration(days: 1)),
    );
    if (pickedDate == null || !context.mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(appointment.slotStart),
    );
    if (pickedTime == null || !context.mounted) return;

    final newSlot = DateTime(
      pickedDate.year,
      pickedDate.month,
      pickedDate.day,
      pickedTime.hour,
      pickedTime.minute,
    );
    final conflict = await FirebaseFirestore.instance
        .collection('appointments')
        .where('slotStart', isEqualTo: Timestamp.fromDate(newSlot))
        .where('status', whereIn: ['pending', 'booked'])
        .limit(1)
        .get();
    final hasConflict = conflict.docs.any((doc) => doc.id != appointment.ref.id);
    if (hasConflict) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('That slot is already pending or booked.')),
        );
      }
      return;
    }
    if (!context.mounted) return;

    final formatted = MaterialLocalizations.of(context).formatFullDate(newSlot);
    final time = MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(newSlot));
    final message = 'NJN Perio & Implant: Your appointment is confirmed for $formatted at $time. Thank you.';

    await openSms(appointment.patientPhone, message);
    if (context.mounted) {
      final sent = await confirmSmsSent(context);
      if (sent) {
        final originalSlotStart = appointment.slotStart;
        await appointment.ref.update({
          'slotStart': Timestamp.fromDate(newSlot),
          'status': 'booked',
        });
        final slotStatusCollection = FirebaseFirestore.instance.collection('slotStatus');
        await slotStatusCollection
            .doc(appointment.ref.id)
            .set({'slotStart': Timestamp.fromDate(originalSlotStart), 'status': 'cancelled'});
        await slotStatusCollection
            .doc(slotDocId(newSlot))
            .set({'slotStart': Timestamp.fromDate(newSlot), 'status': 'booked'});
        if (context.mounted) Navigator.of(context).pop();
      }
    }
  }

  Future<void> _avoid(BuildContext context) async {
    await appointment.ref.update({'status': 'cancelled'});
    await FirebaseFirestore.instance
        .collection('slotStatus')
        .doc(appointment.ref.id)
        .set({'slotStart': Timestamp.fromDate(appointment.slotStart), 'status': 'cancelled'});
    if (context.mounted) Navigator.of(context).pop();
  }
}

class DetailRow extends StatelessWidget {
  const DetailRow({required this.label, required this.value, super.key});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 4),
          Text(value),
        ],
      ),
    );
  }
}

class Appointment {
  Appointment({
    required this.ref,
    required this.patientName,
    required this.patientAge,
    required this.patientPhone,
    required this.description,
    required this.slotStart,
    required this.fileURL,
  });

  final DocumentReference<Map<String, dynamic>> ref;
  final String patientName;
  final int patientAge;
  final String patientPhone;
  final String description;
  final DateTime slotStart;
  final String? fileURL;

  String get formattedDate {
    final date = '${slotStart.year}-${slotStart.month.toString().padLeft(2, '0')}-${slotStart.day.toString().padLeft(2, '0')}';
    return date;
  }

  String get formattedTime {
    final hour = slotStart.hour.toString().padLeft(2, '0');
    final minute = slotStart.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  String get formattedSlot => '$formattedDate at $formattedTime';

  factory Appointment.fromDoc(QueryDocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    return Appointment(
      ref: doc.reference,
      patientName: data['patientName'] ?? '',
      patientAge: data['patientAge'] ?? 0,
      patientPhone: data['patientPhone'] ?? '',
      description: data['description'] ?? '',
      slotStart: (data['slotStart'] as Timestamp).toDate(),
      fileURL: data['fileURL'],
    );
  }
}

String slotDocId(DateTime date) => 'slot_${date.millisecondsSinceEpoch}';

Future<void> openSms(String phone, String body) async {
  final uri = Uri(
    scheme: 'sms',
    path: phone,
    queryParameters: {'body': body},
  );
  if (!await launchUrl(uri)) {
    throw Exception('Could not open SMS app.');
  }
}

Future<bool> confirmSmsSent(BuildContext context) async {
  return await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Did you send the SMS?'),
          content: const Text('Mark this appointment as booked only after sending the text message.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Not yet'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Yes, mark booked'),
            ),
          ],
        ),
      ) ??
      false;
}
