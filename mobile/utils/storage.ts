import AsyncStorage from '@react-native-async-storage/async-storage';
import { EstimateData } from '../types';

const ESTIMATES_STORAGE_KEY = '@fach_oferta_estimates';
const PENDING_SYNC_STORAGE_KEY = '@fach_oferta_pending_sync';

const readPendingEstimates = async (): Promise<EstimateData[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(PENDING_SYNC_STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Błąd pobierania kolejki synchronizacji:', e);
    return [];
  }
};

export const getSavedEstimates = async (): Promise<EstimateData[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(ESTIMATES_STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Błąd pobierania historii wycen:', e);
    return [];
  }
};

export const saveEstimate = async (newEstimate: EstimateData): Promise<void> => {
  try {
    const existingEstimates = await getSavedEstimates();
    // Dodajemy nową wycenę na początek listy
    const updatedEstimates = [newEstimate, ...existingEstimates];
    await AsyncStorage.setItem(ESTIMATES_STORAGE_KEY, JSON.stringify(updatedEstimates));
  } catch (e) {
    console.error('Błąd zapisywania wyceny:', e);
  }
};

export const updateEstimate = async (updatedEstimate: EstimateData): Promise<EstimateData[]> => {
  try {
    const existingEstimates = await getSavedEstimates();
    const updatedEstimates = existingEstimates.map((estimate) =>
      estimate.id === updatedEstimate.id ? updatedEstimate : estimate
    );
    await AsyncStorage.setItem(ESTIMATES_STORAGE_KEY, JSON.stringify(updatedEstimates));
    return updatedEstimates;
  } catch (e) {
    console.error('Błąd aktualizacji wyceny:', e);
    return [];
  }
};

export const addPendingEstimate = async (estimate: EstimateData): Promise<void> => {
  const pending = await readPendingEstimates();
  const withoutDuplicate = pending.filter((item) => item.id !== estimate.id);
  await AsyncStorage.setItem(
    PENDING_SYNC_STORAGE_KEY,
    JSON.stringify([estimate, ...withoutDuplicate])
  );
};

export const getPendingEstimates = readPendingEstimates;

export const removePendingEstimate = async (estimateId: string): Promise<void> => {
  const pending = await readPendingEstimates();
  await AsyncStorage.setItem(
    PENDING_SYNC_STORAGE_KEY,
    JSON.stringify(pending.filter((item) => item.id !== estimateId))
  );
};

export const deleteEstimate = async (estimateNumber: string): Promise<EstimateData[]> => {
  try {
    const existingEstimates = await getSavedEstimates();
    const updatedEstimates = existingEstimates.filter((item) => item.estimateNumber !== estimateNumber);
    await AsyncStorage.setItem(ESTIMATES_STORAGE_KEY, JSON.stringify(updatedEstimates));
    return updatedEstimates;
  } catch (e) {
    console.error('Błąd usuwania wyceny:', e);
    return [];
  }
};