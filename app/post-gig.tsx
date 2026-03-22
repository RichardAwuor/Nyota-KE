import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { apiCall } from '@/utils/api';
import { SERVICE_CATEGORIES } from '@/constants/data';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

export default function PostGigScreen() {
  const router = useRouter();
  const { user } = useUser();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const [category, setCategory] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [serviceTime, setServiceTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [durationHours, setDurationHours] = useState('1');
  const [paymentOffer, setPaymentOffer] = useState('');
  const [loading, setLoading] = useState(false);

  const formatDate = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  const formatTime = (d: Date) =>
    `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  const handlePost = async () => {
    console.log('[PostGig] Post button pressed', { category, address, description, durationHours, paymentOffer });
    if (!category) { Alert.alert('Error', 'Please select a service category'); return; }
    if (!address.trim()) { Alert.alert('Error', 'Please enter an address'); return; }
    if (!description.trim()) { Alert.alert('Error', 'Please enter a description'); return; }
    const payment = parseInt(paymentOffer, 10);
    if (isNaN(payment) || payment < 1) { Alert.alert('Error', 'Please enter a valid payment amount'); return; }
    const hours = parseInt(durationHours, 10);
    if (isNaN(hours) || hours < 1) { Alert.alert('Error', 'Duration must be at least 1 hour'); return; }
    if (!user?.id) { Alert.alert('Error', 'Please log in again'); return; }

    setLoading(true);
    try {
      console.log('[PostGig] POST /api/gigs', { clientId: user.id, category });
      const year = serviceDate.getFullYear();
      const month = String(serviceDate.getMonth() + 1).padStart(2, '0');
      const day = String(serviceDate.getDate()).padStart(2, '0');
      const serviceDateISO = `${year}-${month}-${day}`;

      const payload = {
        clientId: user.id,
        category,
        serviceDate: serviceDateISO,
        serviceTime: formatTime(serviceTime),
        address: address.trim(),
        description: description.trim(),
        durationHours: hours,
        paymentOffer: payment,
      };

      console.log('[PostGig] Request payload:', JSON.stringify(payload));

      await apiCall('/api/gigs', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!mounted.current) return;
      console.log('[PostGig] Gig posted successfully, navigating to home');
      router.replace('/(tabs)');
    } catch (error) {
      if (!mounted.current) return;
      console.log('[PostGig] Error posting gig:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to post gig');
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Post a Gig</Text>

        <Text style={styles.label}>Service Category *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={category}
            onValueChange={(val) => setCategory(val)}
            style={styles.picker}
          >
            <Picker.Item label="Select category..." value="" />
            {SERVICE_CATEGORIES.map((cat) => (
              <Picker.Item key={cat} label={cat} value={cat} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Service Date *</Text>
        <TouchableOpacity style={styles.input} onPress={() => { console.log('[PostGig] Date picker opened'); setShowDatePicker(true); }}>
          <Text style={styles.inputText}>{formatDate(serviceDate)}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={serviceDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(e, date) => {
              setShowDatePicker(false);
              if (e.type === 'set' && date) setServiceDate(date);
            }}
          />
        )}

        <Text style={styles.label}>Service Time *</Text>
        <TouchableOpacity style={styles.input} onPress={() => { console.log('[PostGig] Time picker opened'); setShowTimePicker(true); }}>
          <Text style={styles.inputText}>{formatTime(serviceTime)}</Text>
        </TouchableOpacity>
        {showTimePicker && (
          <DateTimePicker
            value={serviceTime}
            mode="time"
            display="default"
            onChange={(e, time) => {
              setShowTimePicker(false);
              if (e.type === 'set' && time) setServiceTime(time);
            }}
          />
        )}

        <Text style={styles.label}>Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter gig address"
          value={address}
          onChangeText={setAddress}
          maxLength={60}
        />

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the work needed"
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Duration (hours) *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 3"
          value={durationHours}
          onChangeText={setDurationHours}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Payment Offer (KES) *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter amount"
          value={paymentOffer}
          onChangeText={setPaymentOffer}
          keyboardType="number-pad"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handlePost}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Post Gig</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#111', marginBottom: 24 },
  label: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 14, fontSize: 16, backgroundColor: '#fafafa', color: '#111',
  },
  inputText: { fontSize: 16, color: '#111' },
  textArea: { minHeight: 100 },
  pickerContainer: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    backgroundColor: '#fafafa', overflow: 'hidden',
  },
  picker: { height: 52, color: '#111' },
  button: {
    backgroundColor: '#E53935', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 32,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
