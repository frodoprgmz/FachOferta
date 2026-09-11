import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import { AppState, Linking } from 'react-native';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { WebView } from 'react-native-webview';
import { EstimateItem, EstimateData, Contractor } from './types';
import { generateAndSharePDF, getEstimateHTML } from './utils/pdfGenerator';
import {
  saveEstimate,
  getSavedEstimates,
  deleteEstimate,
  updateEstimate,
  addPendingEstimate,
  getPendingEstimates,
  removePendingEstimate,
} from './utils/storage';

const CONTRACTOR_STORAGE_KEY = '@fach_oferta_contractor';

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
  const [includeAcceptanceLink, setIncludeAcceptanceLink] = useState(true);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [contractor, setContractor] = useState<Contractor>({
    companyName: '',
    phone: '',
    email: '',
    bankAccount: '',
    nip: '',
    logoBase64: '',
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<EstimateData[]>([]);

  // Stan dla podglądu PDF
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewIsHistory, setPreviewIsHistory] = useState(false);
  const [currentEstimateData, setCurrentEstimateData] = useState<EstimateData | null>(null);
  const [editingEstimateId, setEditingEstimateId] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<any | null>(null);
  const [subscriptionProfile, setSubscriptionProfile] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const syncingRef = useRef(false);
  const OAUTH_REDIRECT_URI = 'fachoferta://auth/callback';

  const getSubscriptionState = () => {
    if (!sessionUser || !subscriptionProfile) {
      return { isActive: false, status: 'not_logged_in' };
    }

    const expiresAt = subscriptionProfile.subscription_expires_at ? new Date(subscriptionProfile.subscription_expires_at) : null;
    const isActive = subscriptionProfile.subscription_status === 'active' || subscriptionProfile.subscription_status === 'trial';
    const notExpired = !expiresAt || expiresAt.getTime() > Date.now();
    return { isActive: isActive && notExpired, status: subscriptionProfile.subscription_status || 'trial' };
  };

  useEffect(() => {
    const init = async () => {
      setAuthLoading(true);
      await loadContractorData();

      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await hydrateUserSession(session.user);
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await hydrateUserSession(session.user);
      }
      setAuthLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          await hydrateUserSession(session.user);
        } else {
          setSessionUser(null);
          setSubscriptionProfile(null);
          setAuthLoading(false);
        }
      });

      const subscriptionLink = Linking.addEventListener('url', async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await hydrateUserSession(session.user);
        }
      });

      return () => {
        subscription.unsubscribe();
        subscriptionLink.remove();
      };
    };

    void init();

    const syncIfOnline = async (isConnected: boolean | null) => {
      if (isConnected) {
        await syncPendingEstimates();
      }
    };
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      void syncIfOnline(state.isConnected);
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshCurrentUserProfile();
        void NetInfo.fetch().then((networkState) => syncIfOnline(networkState.isConnected));
      }
    });

    const profileRefreshInterval = setInterval(() => {
      void refreshCurrentUserProfile();
    }, 15000);

    void NetInfo.fetch().then((networkState) => syncIfOnline(networkState.isConnected));

    return () => {
      unsubscribeNetInfo();
      appStateSubscription.remove();
      clearInterval(profileRefreshInterval);
    };
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

  const hydrateUserSession = async (user: any) => {
    setSessionUser(user);
    await refreshUserProfile(user.id);
  };

  const refreshUserProfile = async (userId: string) => {
    try {
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      let data = existingProfile;
      if (!data) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: createdProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            full_name: user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email,
            company_name: '',
            subscription_status: 'trial',
            subscription_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();

        if (createError) {
          throw createError;
        }
        data = createdProfile;
      }

      if (data) {
        setSubscriptionProfile(data);
      }
    } catch (e) {
      console.error('Błąd ładowania profilu użytkownika:', e);
    }
  };

  const refreshCurrentUserProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await refreshUserProfile(session.user.id);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: OAUTH_REDIRECT_URI,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        Alert.alert('Błąd logowania', error.message);
        return;
      }

      if (!data?.url) {
        Alert.alert('Błąd logowania', 'Supabase nie zwrócił adresu logowania.');
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT_URI);
      if (result.type !== 'success' || !result.url) {
        if (result.type !== 'cancel' && result.type !== 'dismiss') {
          Alert.alert('Błąd logowania', 'Nie udało się wrócić z logowania do aplikacji.');
        }
        return;
      }

      const callbackUrl = new URL(result.url);
      const code = callbackUrl.searchParams.get('code');
      if (!code) {
        const authError = callbackUrl.searchParams.get('error_description') || callbackUrl.searchParams.get('error');
        Alert.alert('Błąd logowania', authError || 'Brak kodu autoryzacyjnego w odpowiedzi.');
        return;
      }

      const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        Alert.alert('Błąd logowania', exchangeError.message);
        return;
      }

      if (sessionData.session?.user) {
        await hydrateUserSession(sessionData.session.user);
      }
    } catch (e) {
      Alert.alert('Błąd logowania', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const handleGoogleLogout = async () => {
    await supabase.auth.signOut();
    setSessionUser(null);
    setSubscriptionProfile(null);
    Alert.alert('Wylogowano', 'Sesja została zakończona.');
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

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const mimeType = result.assets[0].mimeType || 'image/png';
      const base64Image = `data:${mimeType};base64,${result.assets[0].base64}`;
      setContractor({ ...contractor, logoBase64: base64Image });
    }
  };

  const removeLogo = () => {
    setContractor({ ...contractor, logoBase64: '' });
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

  const handleEditHistoryItem = (estimate: EstimateData) => {
    setClientName(estimate.client.name);
    setClientPhone(estimate.client.phone);
    setClientAddress(estimate.client.address);
    setItems(estimate.items);
    setAdvancePercent(String(estimate.advancePercent));
    setIncludeAcceptanceLink(estimate.includeAcceptanceLink !== false);
    setEditingEstimateId(estimate.id);
    setIsHistoryOpen(false);
    Alert.alert('Edycja wyceny', 'Wycena została wczytana. Zmień dane i wybierz „Zapisz wycenę”.');
  };

  const handleHistoryPreview = (estimate: EstimateData) => {
    setCurrentEstimateData(estimate);
    setPreviewHtml(getEstimateHTML(estimate));
    setPreviewIsHistory(true);
    setIsHistoryOpen(false);
    setIsPreviewOpen(true);
  };

  const syncPendingEstimates = async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    try {
      if (!sessionUser?.id) {
        return;
      }

      const pending = await getPendingEstimates();
      for (const estimate of pending) {
        const { error } = await supabase.from('estimates').upsert(
          {
            id: estimate.id,
            user_id: sessionUser.id,
            estimate_number: estimate.estimateNumber,
            contractor: estimate.contractor,
            client: estimate.client,
            items: estimate.items,
            advance_percent: estimate.advancePercent,
            status: estimate.status || 'sent',
          },
          { onConflict: 'id' }
        );

        if (error) {
          console.error('Synchronizacja wyceny nie powiodła się:', error);
          continue;
        }

        await removePendingEstimate(estimate.id);
      }
    } finally {
      syncingRef.current = false;
    }
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

  const buildEstimateData = (): EstimateData | null => {
    if (!contractor.companyName) {
      Alert.alert('Brak danych firmy', 'Uzupełnij najpierw dane swojej firmy w zakładce "⚙️ Dane".', [
        { text: 'Otwórz Ustawienia', onPress: () => setIsSettingsOpen(true) },
        { text: 'Anuluj', style: 'cancel' },
      ]);
      return null;
    }

    if (!clientName) {
      Alert.alert('Brak danych', 'Podaj imię i nazwisko klienta');
      return null;
    }

    if (items.length === 0) {
      Alert.alert('Pusta wycena', 'Dodaj co najmniej jedną pozycję do kosztorysu');
      return null;
    }

    const estimatedId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
          const random = Math.floor(Math.random() * 16);
          const value = char === 'x' ? random : (random & 0x3) | 0x8;
          return value.toString(16);
        });

    return {
      id: estimatedId,
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
      includeAcceptanceLink,
      status: 'sent',
    };
  };

  const handlePreviewPDF = () => {
    const data = buildEstimateData();
    if (!data) return;

    if (editingEstimateId) {
      const original = history.find((estimate) => estimate.id === editingEstimateId);
      data.id = editingEstimateId;
      if (original) {
        data.estimateNumber = original.estimateNumber;
        data.issueDate = original.issueDate;
      }
    }
    setPreviewIsHistory(false);
    setCurrentEstimateData(data);
    setPreviewHtml(getEstimateHTML(data));
    setIsPreviewOpen(true);
  };

  const saveAndSendEstimate = async (data: EstimateData) => {
    try {
      // Zapis lokalny jest źródłem prawdy, więc PDF działa także bez internetu.
      if (editingEstimateId === data.id) {
        await updateEstimate(data);
      } else {
        await saveEstimate(data);
      }

      if (sessionUser?.id) {
        let syncError: { message: string } | null = null;
        try {
          const { error } = await supabase.from('estimates').upsert(
            {
              id: data.id,
              user_id: sessionUser.id,
              estimate_number: data.estimateNumber,
              contractor: data.contractor,
              client: data.client,
              items: data.items,
              advance_percent: data.advancePercent,
              status: 'sent',
            },
            { onConflict: 'id' }
          );
          syncError = error;
        } catch (error) {
          syncError = { message: error instanceof Error ? error.message : 'Błąd połączenia' };
        }

        if (syncError) {
          console.warn('Wycena czeka na synchronizację:', syncError.message);
          await addPendingEstimate(data);
        } else {
          console.log('✅ Wycena zapisana w chmurze Supabase!');
          await removePendingEstimate(data.id);
        }
      }

      // Generowanie PDF z linkiem, który będzie aktywny po synchronizacji.
      await generateAndSharePDF(data);

      // Czyszczenie pól formularza
      setClientName('');
      setClientPhone('');
      setClientAddress('');
      setItems([]);
      setIncludeAcceptanceLink(true);
      setEditingEstimateId(null);
    } catch (e) {
      console.error(e);
      Alert.alert('Błąd', 'Nie udało się przetworzyć wyceny.');
    }
  };

  const handleGeneratePDF = async () => {
    const { isActive } = getSubscriptionState();
    if (!isActive) {
      Alert.alert('Dostęp wygasł', 'Twoja subskrypcja nie jest aktywna. Skontaktuj się z administratorem.');
      return;
    }

    const data = buildEstimateData();
    if (!data) return;
    if (editingEstimateId) {
      const original = history.find((estimate) => estimate.id === editingEstimateId);
      data.id = editingEstimateId;
      if (original) {
        data.estimateNumber = original.estimateNumber;
        data.issueDate = original.issueDate;
      }
    }
    await saveAndSendEstimate(data);
  };

  const handleSendFromPreview = async () => {
    if (!currentEstimateData) return;
    setIsPreviewOpen(false);
    if (previewIsHistory) return;
    await saveAndSendEstimate(currentEstimateData);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerBar}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>🛠️ FachOferta</Text>
            <Text style={styles.subtitle}>Szybka wycena u klienta</Text>
            <Text style={styles.authText}>
              {authLoading
                ? 'Ładowanie konta...'
                : sessionUser
                  ? `Zalogowano: ${sessionUser.email}`
                  : 'Logowanie: brak konta'}
            </Text>
            <Text style={styles.authStatusText}>
              {getSubscriptionState().isActive ? 'Status: aktywny' : 'Status: wygasły'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {!sessionUser ? (
              <TouchableOpacity style={styles.topBtn} onPress={handleGoogleLogin}>
                <Text style={styles.topBtnText}>🔐 Logowanie</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.topBtn} onPress={handleGoogleLogout}>
                <Text style={styles.topBtnText}>🚪 Wyloguj</Text>
              </TouchableOpacity>
            )}
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
            <View style={styles.optionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Link do akceptacji online</Text>
                <Text style={styles.optionHint}>Wyłącz, jeśli klient nie ma zatwierdzać wyceny przez internet.</Text>
              </View>
              <Switch
                value={includeAcceptanceLink}
                onValueChange={setIncludeAcceptanceLink}
                trackColor={{ false: '#cbd5e1', true: '#86efac' }}
                thumbColor={includeAcceptanceLink ? '#16a34a' : '#f8fafc'}
              />
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 40 }}>
          <TouchableOpacity
            style={[styles.generateButton, { flex: 1, backgroundColor: '#3b82f6' }]}
            onPress={handlePreviewPDF}
          >
            <Text style={styles.generateButtonText}>👁️ Podgląd</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.generateButton, { flex: 1.5, backgroundColor: '#16a34a' }]}
            onPress={handleGeneratePDF}
          >
            <Text style={styles.generateButtonText}>Zapisz wycenę</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL PODGLĄDU DOKUMENTU */}
      <Modal visible={isPreviewOpen} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
          <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Podgląd wyceny</Text>
            <TouchableOpacity onPress={() => setIsPreviewOpen(false)} style={{ padding: 6 }}>
              <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 16 }}>Zamknij</Text>
            </TouchableOpacity>
          </View>

          <WebView originWhitelist={['*']} source={{ html: previewHtml }} style={{ flex: 1 }} />

          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSendFromPreview}>
              <Text style={styles.saveBtnText}>
                {previewIsHistory ? 'Zamknij podgląd' : editingEstimateId ? 'Zapisz zmiany' : 'Zapisz wycenę'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

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
                            style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                            onPress={() => handleHistoryPreview(est)}
                          >
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>Podgląd</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                            onPress={() => handleEditHistoryItem(est)}
                          >
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>Edytuj</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                            onPress={() => handleDeleteHistoryItem(est.estimateNumber)}
                          >
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>Usuń</Text>
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

            <Text style={styles.label}>Logo Firmy</Text>
            {contractor.logoBase64 ? (
              <View style={{ alignItems: 'center', marginVertical: 10 }}>
                <Image
                  source={{ uri: contractor.logoBase64 }}
                  style={{ width: 120, height: 60, resizeMode: 'contain', marginBottom: 8 }}
                />
                <TouchableOpacity onPress={removeLogo}>
                  <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>Usuń logo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.logoBtn} onPress={pickLogo}>
                <Text style={styles.logoBtnText}>📷 Wybierz logo z galerii</Text>
              </TouchableOpacity>
            )}

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
    width: '100%',
    marginBottom: 20,
  },
  headerInfo: { width: '100%', marginBottom: 10 },
  headerActions: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b' },
  authText: { fontSize: 11, color: '#334155', marginTop: 4 },
  authStatusText: { fontSize: 11, color: '#0f766e', marginTop: 2 },
  topBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexGrow: 1,
    minWidth: 96,
    alignItems: 'center',
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  optionTitle: { fontSize: 13, fontWeight: '600', color: '#334155' },
  optionHint: { fontSize: 11, color: '#64748b', marginTop: 3 },
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
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  generateButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  saveBtn: {
    backgroundColor: '#16a34a',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  cancelBtn: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  logoBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f8fafc',
  },
  logoBtnText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
});