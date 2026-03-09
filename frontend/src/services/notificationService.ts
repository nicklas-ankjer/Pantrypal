import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationSettings {
  emergency_alerts_enabled: boolean;
}

export const notificationService = {
  /**
   * Request permission and get push token
   */
  async registerForPushNotifications(userId: string): Promise<string | null> {
    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Get the Expo push token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID, // Optional: your Expo project ID
      });
      
      const pushToken = tokenData.data;
      console.log('Push token:', pushToken);

      // Register the token with our backend
      await axios.post(`${API_BASE}/api/push-token/register`, {
        user_id: userId,
        push_token: pushToken,
      });

      return pushToken;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  },

  /**
   * Remove push token (call on logout)
   */
  async unregisterPushToken(userId: string): Promise<void> {
    try {
      await axios.delete(`${API_BASE}/api/push-token/${userId}`);
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  },

  /**
   * Get notification settings
   */
  async getSettings(userId: string): Promise<NotificationSettings> {
    try {
      const response = await axios.get(`${API_BASE}/api/notification-settings/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return { emergency_alerts_enabled: true };
    }
  },

  /**
   * Update notification settings
   */
  async updateSettings(userId: string, settings: NotificationSettings): Promise<void> {
    try {
      await axios.put(`${API_BASE}/api/notification-settings/${userId}`, settings);
    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw error;
    }
  },

  /**
   * Send a test notification
   */
  async sendTestNotification(userId: string): Promise<boolean> {
    try {
      await axios.post(`${API_BASE}/api/notifications/test/${userId}`);
      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  },

  /**
   * Add a listener for received notifications
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationReceivedListener(callback);
  },

  /**
   * Add a listener for notification responses (when user taps notification)
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  },

  /**
   * Schedule a local notification (for testing)
   */
  async scheduleLocalNotification(title: string, body: string, seconds: number = 1): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: { seconds },
    });
  },

  /**
   * Configure Android notification channel
   */
  async setupAndroidChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('emergency-alerts', {
        name: 'Emergency Stock Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B6B',
        sound: 'default',
      });
    }
  },
};
