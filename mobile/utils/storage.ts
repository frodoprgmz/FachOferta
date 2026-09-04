import AsyncStorage from '@react-native-async-storage/async-storage';
import { EstimateData } from '../types';

const ESTIMATES_STORAGE_KEY = '@fach_oferta_estimates';

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