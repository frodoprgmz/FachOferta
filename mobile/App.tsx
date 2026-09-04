import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EstimateItem, EstimateData } from './types';
import { generateAndSharePDF } from './utils/pdfGenerator';

export default function App() {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  const [items, setItems] = useState<EstimateItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('m2');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [advancePercent, setAdvancePercent] = useState('30');

  const addItem = () => {
    if (!itemName || !itemPrice) {
      Alert.alert('Błąd', 'Wpisz nazwę usługi oraz cenę');
      return;
    }

    const qty = parseFloat(itemQuantity) || 1;
    const price = parseFloat(itemPrice) || 0;

    const newItem: EstimateItem = {
      id: Date.now().toString(),
      name: itemName,
      unit: itemUnit,
      quantity: qty,
      unitPriceNet: price,
      totalNet: qty * price,
    };

    setItems([...items, newItem]);
    setItemName('');
    setItemPrice('');
    setItemQuantity('1');
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const totalNet = items.reduce((sum, item) => sum + item.totalNet, 0);

  const handleGeneratePDF = async () => {
    if (!clientName) {
      Alert.alert('Brak danych', 'Podaj imię i nazwisko klienta');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Pusta wycena', 'Dodaj co najmniej jedną pozycję do kosztorysu');
      return;
    }

    const estimateData: EstimateData = {
      estimateNumber: `WYC/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
      issueDate: new Date().toLocaleDateString('pl-PL'),
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('pl-PL'),
      contractor: {
        companyName: 'Usługi Budowlane Jan Kowalski',
        phone: '+48 600 700 800',
        email: 'kontakt@jan-bud.pl',
        bankAccount: '12 3456 7890 0000 0000 1234 5678',
      },
      client: {
        name: clientName,
        phone: clientPhone,
        address: clientAddress,
      },
      items,
      advancePercent: parseFloat(advancePercent) || 0,
    };

    await generateAndSharePDF(estimateData);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>🛠️ FachOferta</Text>
        <Text style={styles.subtitle}>Szybka wycena u klienta</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Dane Klienta</Text>
          <TextInput
            style={styles.input}
            placeholder="Imię i Nazwisko / Firma"
            value={clientName}
            onChangeText={setClientName}
          />
          <TextInput
            style={styles.input}
            placeholder="Numer telefonu"
            keyboardType="phone-pad"
            value={clientPhone}
            onChangeText={setClientPhone}
          />
          <TextInput
            style={styles.input}
            placeholder="Adres inwestycji (miejscowość, ulica)"
            value={clientAddress}
            onChangeText={setClientAddress}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>➕ Dodaj Usługę / Materiał</Text>
          <TextInput
            style={styles.input}
            placeholder="Nazwa (np. Układanie płyt g-k)"
            value={itemName}
            onChangeText={setItemName}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              placeholder="Ilość"
              keyboardType="numeric"
              value={itemQuantity}
              onChangeText={setItemQuantity}
            />
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              placeholder="J.m. (m2, szt)"
              value={itemUnit}
              onChangeText={setItemUnit}
            />
            <TextInput
              style={[styles.input, { flex: 1.5 }]}
              placeholder="Cena netto (zł)"
              keyboardType="numeric"
              value={itemPrice}
              onChangeText={setItemPrice}
            />
          </View>
          <TouchableOpacity style={styles.addButton} onPress={addItem}>
            <Text style={styles.addButtonText}>+ Dodaj do listy</Text>
          </TouchableOpacity>
        </View>

        {items.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Kosztorys ({items.length})</Text>
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>
                    {item.quantity} {item.unit} x {item.unitPriceNet.toFixed(2)} zł
                  </Text>
                </View>
                <Text style={styles.itemTotal}>{item.totalNet.toFixed(2)} zł</Text>
                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                  <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.summaryContainer}>
              <Text style={styles.summaryText}>Suma Netto: {totalNet.toFixed(2)} PLN</Text>
              <Text style={styles.summaryTextBold}>
                Suma Brutto (z VAT 23%): {(totalNet * 1.23).toFixed(2)} PLN
              </Text>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 12, color: '#64748b' }}>Wymagana zaliczka (%):</Text>
              <TextInput
                style={[styles.input, { marginTop: 4 }]}
                keyboardType="numeric"
                value={advancePercent}
                onChangeText={setAdvancePercent}
              />
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.generateButton} onPress={handleGeneratePDF}>
          <Text style={styles.generateButtonText}>🚀 Wygeneruj i Wyślij PDF</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: '#f8fafc',
  },
  row: { flexDirection: 'row' },
  addButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  itemSub: { fontSize: 12, color: '#64748b' },
  itemTotal: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginRight: 10 },
  removeBtn: { padding: 6 },
  summaryContainer: {
    marginTop: 15,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#0f172a',
  },
  summaryText: { fontSize: 13, color: '#475569' },
  summaryTextBold: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginTop: 4 },
  generateButton: {
    backgroundColor: '#16a34a',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 40,
  },
  generateButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
});