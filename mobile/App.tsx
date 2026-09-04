import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EstimateItem, EstimateData, Contractor } from './types';
import { generateAndSharePDF } from './utils/pdfGenerator';
import { saveEstimate, getSavedEstimates, deleteEstimate } from './utils/storage';

const CONTRACTOR_STORAGE_KEY = '@fach_oferta_contractor';

export default function App() {
  // Dane Klienta
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');

  // Dane Usługi
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('m2');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [advancePercent, setAdvancePercent] = useState('30');

  // Modal Ustawień Wykonawcy
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [contractor, setContractor] = useState<Contractor>({
    companyName: '',
    phone: '',
    email: '',
    bankAccount: '',
    nip: '',
  });

  // Modal Historii Wycen
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<EstimateData[]>([]);

  useEffect(() => {
    loadContractorData();
  }, []);

  const loadContractorData = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(CONTRACTOR_STORAGE_KEY);
      if (jsonValue != null) {
        setContractor(JSON.parse(jsonValue));
      }
    } catch (e) {
      console.error('Błąd wczytywania danych firmy:', e);
    }
  };

  const saveContractorData = async () => {
    try {
      await AsyncStorage.setItem(CONTRACTOR_STORAGE_KEY, JSON.stringify(contractor));
      setIsSettingsOpen(false);
      Alert.alert('Sukces', 'Dane Twojej firmy zostały zapisane.');
    } catch (e) {
      console.error('Błąd zapisu danych firmy:', e);
      Alert.alert('Błąd', 'Nie udało się zapisać danych.');
    }
  };

  const openHistory = async () => {
    const saved = await getSavedEstimates();
    setHistory(saved);
    setIsHistoryOpen(true);
  };

  const handleDeleteHistoryItem = async (estimateNumber: string) => {
    Alert.alert('Usuwanie wyceny', `Czy na pewno chcesz usunąć wycenę ${estimateNumber}?`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          const updated = await deleteEstimate(estimateNumber);
          setHistory(updated);
        },
      },
    ]);
  };

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
    if (!contractor.companyName) {
      Alert.alert('Brak danych firmy', 'Uzupełnij najpierw dane swojej firmy w zakładce "⚙️ Moje Dane".', [
        { text: 'Otwórz Ustawienia', onPress: () => setIsSettingsOpen(true) },
        { text: 'Anuluj', style: 'cancel' },
      ]);
      return;
    }

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
      contractor,
      client: {
        name: clientName,
        phone: clientPhone,
        address: clientAddress,
      },
      items,
      advancePercent: parseFloat(advancePercent) || 0,
    };

    // Auto-zapis do pamięci urządzenia
    await saveEstimate(estimateData);

    // Generowanie i udostępnienie PDF
    await generateAndSharePDF(estimateData);

    // Czyszczenie formularza po sukcesie
    setClientName('');
    setClientPhone('');
    setClientAddress('');
    setItems([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.title}>🛠️ FachOferta</Text>
            <Text style={styles.subtitle}>Szybka wycena u klienta</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.topBtn} onPress={openHistory}>
              <Text style={styles.topBtnText}>📜 Historia</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.topBtn} onPress={() => setIsSettingsOpen(true)}>
              <Text style={styles.topBtnText}>⚙️ Dane</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DANE KLIENTA */}
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

        {/* DODAWANIE POZYCJI */}
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

        {/* LISTA POZYCJI */}
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

      {/* MODAL HISTORII WYCEN */}
      <Modal visible={isHistoryOpen} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={{ padding: 20, flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>📜 Historia Wycen</Text>
              <TouchableOpacity onPress={() => setIsHistoryOpen(false)}>
                <Text style={{ color: '#2563eb', fontWeight: 'bold', fontSize: 16 }}>Zamknij</Text>
              </TouchableOpacity>
            </View>

            {history.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#94a3b8', fontSize: 16 }}>Brak zapisanych wycen</Text>
              </View>
            ) : (
              <ScrollView>
                {history.map((est) => {
                  const estTotal = est.items.reduce((s, i) => s + i.totalNet, 0) * 1.23;
                  return (
                    <View key={est.estimateNumber} style={styles.card}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontWeight: 'bold', color: '#2563eb' }}>{est.estimateNumber}</Text>
                        <Text style={{ fontSize: 12, color: '#64748b' }}>{est.issueDate}</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#0f172a' }}>{est.client.name}</Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{est.client.address || 'Brak adresu'}</Text>
                      
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{estTotal.toFixed(2)} PLN brutto</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity
                            style={{ backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                            onPress={() => handleDeleteHistoryItem(est.estimateNumber)}
                          >
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>Usuń</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ backgroundColor: '#16a34a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                            onPress={() => generateAndSharePDF(est)}
                          >
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>PDF 📄</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL USTAWIEŃ DANYCH FIRMY */}
      <Modal visible={isSettingsOpen} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 6 }}>
              ⚙️ Ustawienia Twojej Firmy
            </Text>
            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              Te dane będą automatycznie trafiać na każdy wygenerowany dokument PDF.
            </Text>

            <Text style={styles.label}>Nazwa Firmy / Imię i Nazwisko *</Text>
            <TextInput
              style={styles.input}
              placeholder="np. Usługi Budowlane Jan Kowalski"
              value={contractor.companyName}
              onChangeText={(text) => setContractor({ ...contractor, companyName: text })}
            />

            <Text style={styles.label}>NIP (opcjonalnie)</Text>
            <TextInput
              style={styles.input}
              placeholder="np. 1234567890"
              keyboardType="numeric"
              value={contractor.nip}
              onChangeText={(text) => setContractor({ ...contractor, nip: text })}
            />

            <Text style={styles.label}>Telefon kontaktowy</Text>
            <TextInput
              style={styles.input}
              placeholder="np. +48 600 700 800"
              keyboardType="phone-pad"
              value={contractor.phone}
              onChangeText={(text) => setContractor({ ...contractor, phone: text })}
            />

            <Text style={styles.label}>Adres Email</Text>
            <TextInput
              style={styles.input}
              placeholder="np. kontakt@jan-bud.pl"
              keyboardType="email-address"
              autoCapitalize="none"
              value={contractor.email}
              onChangeText={(text) => setContractor({ ...contractor, email: text })}
            />

            <Text style={styles.label}>Numer konta bankowego (do zaliczek)</Text>
            <TextInput
              style={styles.input}
              placeholder="np. 00 0000 0000 0000 0000 0000 0000"
              keyboardType="numeric"
              value={contractor.bankAccount}
              onChangeText={(text) => setContractor({ ...contractor, bankAccount: text })}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={saveContractorData}>
              <Text style={styles.saveBtnText}>💾 Zapisz Ustawienia</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsSettingsOpen(false)}>
              <Text style={styles.cancelBtnText}>Anuluj</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { padding: 16 },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b' },
  topBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  topBtnText: { fontSize: 12, fontWeight: '600', color: '#334155' },
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
  label: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 },
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
  saveBtn: {
    backgroundColor: '#16a34a',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  cancelBtn: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
});