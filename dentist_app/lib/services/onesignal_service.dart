import 'package:onesignal_flutter/onesignal_flutter.dart';

/// Centralized wrapper around the OneSignal SDK. All direct OneSignal SDK
/// calls should go through this class rather than being called elsewhere.
class OneSignalService {
  static final OneSignalService _instance = OneSignalService._internal();
  factory OneSignalService() => _instance;
  OneSignalService._internal();

  bool _isInitialized = false;

  void initialize(String appId) {
    if (_isInitialized) return;

    // Set log level for debugging (remove in production)
    OneSignal.Debug.setLogLevel(OSLogLevel.verbose);
    OneSignal.initialize(appId);
    _isInitialized = true;
  }

  void login(String externalId) {
    OneSignal.login(externalId);
  }

  void logout() {
    OneSignal.logout();
  }

  void setEmail(String email) {
    OneSignal.User.addEmail(email);
  }

  void setSmsNumber(String number) {
    OneSignal.User.addSms(number);
  }

  void setTag(String key, String value) {
    OneSignal.User.addTagWithKey(key, value);
  }

  Future<bool> requestPermission() async {
    return await OneSignal.Notifications.requestPermission(true);
  }

  void setLogLevel(OSLogLevel level) {
    OneSignal.Debug.setLogLevel(level);
  }

  String? get currentPushSubscriptionId => OneSignal.User.pushSubscription.id;

  void addPushSubscriptionObserver(void Function(OSPushSubscriptionChangedState state) handler) {
    OneSignal.User.pushSubscription.addObserver(handler);
  }
}
