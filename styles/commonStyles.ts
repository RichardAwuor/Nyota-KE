
import { StyleSheet } from 'react-native';

export const colors = {
  // Deep blue and beige theme
  background: '#F5F5DC', // Beige
  backgroundDark: '#0D47A1', // Deep Blue
  
  text: '#2C2C2C',
  textDark: '#F5F5DC', // Beige text on dark
  
  textSecondary: '#6B6B6B',
  textSecondaryDark: '#D4C5A0', // Lighter beige for secondary text
  
  primary: '#0D47A1', // Deep Blue
  primaryDark: '#1565C0', // Lighter deep blue for dark mode
  
  secondary: '#8B7355', // Brown/tan accent
  secondaryDark: '#A68A6A',
  
  accent: '#FFD700', // Gold accent
  accentDark: '#FFC300',
  
  card: '#FFFFFF',
  cardDark: '#1565C0', // Lighter blue for cards in dark mode
  
  highlight: '#E8EAF6', // Light blue highlight
  highlightDark: '#1A237E', // Darker blue highlight
  
  border: '#D4C5A0',
  borderDark: '#5C7FB8',
  
  error: '#DC3545',
  success: '#28A745',
  warning: '#FFC107',
  info: '#17A2B8',
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  containerDark: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardDark: {
    backgroundColor: colors.cardDark,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  inputDark: {
    backgroundColor: colors.cardDark,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.borderDark,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDark: {
    backgroundColor: colors.primaryDark,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
