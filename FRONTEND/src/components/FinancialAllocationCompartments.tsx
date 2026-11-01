import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import {
  ShieldCheck,
  TrendingUp,
  PiggyBank,
  PieChart,
  ChevronDown,
  ChevronUp,
  Edit3,
  RotateCcw,
  Check,
  AlertCircle,
  Sliders,
  Calendar,
  Lock,
} from 'lucide-react-native';
import { THEME, formatINR } from '../constants/theme';
import { useFinance } from '../context/FinanceContext';
import { calculateCompartmentsState } from '../services/compartmentsEngine';

interface FinancialAllocationCompartmentsProps {
  compartments?: any;
  onUpdateEmergencyTarget?: (months: 3 | 6 | 12) => void;
  onNavigateInvestments?: () => void;
  onNavigateSavings?: () => void;
}

const STORAGE_KEY = 'cc_user_custom_allocations_v2';

interface SavedAllocations {
  emergencyAmount: number;
  investmentAmount: number;
  savingsAmount: number;
  targetMonths: 3 | 6 | 12;
  savingsDueDate: string;
}

export const FinancialAllocationCompartments: React.FC<FinancialAllocationCompartmentsProps> = ({
  compartments: propsCompartments,
  onNavigateInvestments,
  onNavigateSavings,
}) => {
  const { transactions, goals, totalBalance } = useFinance();

  const currentTotalCash = totalBalance || 0;

  // Auto baseline from engine
  const autoState =
    propsCompartments ||
    calculateCompartmentsState(transactions, goals, totalBalance, {
      emergencyTargetMonths: 6,
    });

  const monthlyEssential = autoState.monthlyEssentialExpenses || 25000;

  // Saved user allocations state
  const [targetMonths, setTargetMonths] = useState<3 | 6 | 12>(6);
  const [emergencyAlloc, setEmergencyAlloc] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SavedAllocations = JSON.parse(saved);
        if (typeof parsed.emergencyAmount === 'number') return parsed.emergencyAmount;
      }
    } catch {}
    return Math.round(currentTotalCash * 0.4);
  });

  const [investmentAlloc, setInvestmentAlloc] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SavedAllocations = JSON.parse(saved);
        if (typeof parsed.investmentAmount === 'number') return parsed.investmentAmount;
      }
    } catch {}
    return Math.round(currentTotalCash * 0.3);
  });

  const [savingsAlloc, setSavingsAlloc] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SavedAllocations = JSON.parse(saved);
        if (typeof parsed.savingsAmount === 'number') return parsed.savingsAmount;
      }
    } catch {}
    return Math.round(currentTotalCash * 0.2);
  });

  const [savingsDueDate, setSavingsDueDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SavedAllocations = JSON.parse(saved);
        if (parsed.savingsDueDate) return parsed.savingsDueDate;
      }
    } catch {}
    return '2027-03-31';
  });

  // Edit Panel State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editEmergencyInput, setEditEmergencyInput] = useState<string>(String(emergencyAlloc));
  const [editInvestmentInput, setEditInvestmentInput] = useState<string>(String(investmentAlloc));
  const [editSavingsInput, setEditSavingsInput] = useState<string>(String(savingsAlloc));
  const [editSavingsDueDate, setEditSavingsDueDate] = useState<string>(savingsDueDate);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);

  // Sync inputs when opening edit
  const handleOpenEdit = (presetField?: 'emergency' | 'investment' | 'savings') => {
    setEditEmergencyInput(String(emergencyAlloc));
    setEditInvestmentInput(String(investmentAlloc));
    setEditSavingsInput(String(savingsAlloc));
    setEditSavingsDueDate(savingsDueDate);
    setIsEditing(true);
  };

  // Real-time calculation during edit
  const parsedEditEmergency = Math.max(0, parseFloat(editEmergencyInput) || 0);
  const parsedEditInvestment = Math.max(0, parseFloat(editInvestmentInput) || 0);
  const parsedEditSavings = Math.max(0, parseFloat(editSavingsInput) || 0);
  const tempAllocatedSum = parsedEditEmergency + parsedEditInvestment + parsedEditSavings;
  const tempUnallocatedCash = Math.max(0, currentTotalCash - tempAllocatedSum);
  const isTempOver = tempAllocatedSum > currentTotalCash;

  // Active saved values summary
  const allocatedSum = emergencyAlloc + investmentAlloc + savingsAlloc;
  const unallocatedCash = Math.max(0, currentTotalCash - allocatedSum);

  // Targets & Progress
  const emergencyTarget = monthlyEssential * targetMonths;
  const emergencyPct =
    emergencyTarget > 0 ? Math.min(100, Math.round((emergencyAlloc / emergencyTarget) * 100)) : 100;
  const emergencyCoverageMonths =
    monthlyEssential > 0 ? Number((emergencyAlloc / monthlyEssential).toFixed(1)) : 0;

  const savingsTarget = autoState.savingsTarget || 50000;
  const savingsPct =
    savingsTarget > 0 ? Math.min(100, Math.round((savingsAlloc / savingsTarget) * 100)) : 100;

  const handleSaveAllocations = () => {
    setEmergencyAlloc(parsedEditEmergency);
    setInvestmentAlloc(parsedEditInvestment);
    setSavingsAlloc(parsedEditSavings);
    setSavingsDueDate(editSavingsDueDate.trim() || '2027-03-31');

    try {
      const data: SavedAllocations = {
        emergencyAmount: parsedEditEmergency,
        investmentAmount: parsedEditInvestment,
        savingsAmount: parsedEditSavings,
        targetMonths,
        savingsDueDate: editSavingsDueDate.trim() || '2027-03-31',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}

    setSaveSuccessNotice(true);
    setTimeout(() => {
      setSaveSuccessNotice(false);
      setIsEditing(false);
    }, 1200);
  };

  const handleResetToAuto = () => {
    const defaultEmerg = Math.min(currentTotalCash, monthlyEssential * targetMonths);
    const left1 = Math.max(0, currentTotalCash - defaultEmerg);
    const defaultSavings = Math.min(left1, 25000);
    const left2 = Math.max(0, left1 - defaultSavings);
    const defaultInvest = Math.min(left2, 20000);

    setEditEmergencyInput(String(defaultEmerg));
    setEditInvestmentInput(String(defaultInvest));
    setEditSavingsInput(String(defaultSavings));
  };

  return (
    <View style={styles.container}>
      {/* Header with Title and User Edit Action */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <PieChart size={18} color={THEME.colors.primary} />
          <View>
            <Text style={styles.headerTitle}>Financial Allocation</Text>
            <Text style={styles.headerSubtitle}>User-Set Compartments • Total Liquid Partition</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.editToggleBtn, isEditing && styles.editToggleBtnActive]}
          onPress={() => (isEditing ? setIsEditing(false) : handleOpenEdit())}
        >
          <Edit3 size={13} color={isEditing ? '#FFF' : THEME.colors.primary} />
          <Text style={[styles.editToggleText, isEditing && { color: '#FFF' }]}>
            {isEditing ? 'Close Edit' : 'Edit Allocations'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* EDIT ALLOCATION PANEL */}
      {isEditing && (
        <View style={styles.editCard}>
          <View style={styles.editCardHeader}>
            <Sliders size={16} color={THEME.colors.primary} />
            <Text style={styles.editCardTitle}>Set Your Money in Each Compartment</Text>
          </View>

          <Text style={styles.editCardDesc}>
            Decide exactly how much money to store in each bucket. Unallocated cash remains liquid and available.
          </Text>

          {/* Live Meter in Edit Mode */}
          <View style={styles.editLiveStats}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Total Cash</Text>
              <Text style={styles.statVal}>{formatINR(currentTotalCash)}</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Allocated Sum</Text>
              <Text style={[styles.statVal, isTempOver && { color: THEME.colors.danger }]}>
                {formatINR(tempAllocatedSum)}
              </Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Unallocated Left</Text>
              <Text style={[styles.statVal, { color: tempUnallocatedCash > 0 ? THEME.colors.primary : THEME.colors.textMuted }]}>
                {formatINR(tempUnallocatedCash)}
              </Text>
            </View>
          </View>

          {isTempOver && (
            <View style={styles.warningBox}>
              <AlertCircle size={14} color="#B91C1C" />
              <Text style={styles.warningText}>
                Allocated sum exceeds total cash by {formatINR(tempAllocatedSum - currentTotalCash)}.
              </Text>
            </View>
          )}

          {/* Field 1: Emergency Fund */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color="#047857" />
                <Text style={styles.inputLabel}>1. Emergency Fund (₹)</Text>
              </View>
              <Text style={styles.inputSubLabel}>Essential bills: {formatINR(monthlyEssential)}/mo</Text>
            </View>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={editEmergencyInput}
              onChangeText={setEditEmergencyInput}
              placeholder="e.g. 50000"
            />
            {/* Quick target months buttons */}
            <View style={styles.targetMonthsRow}>
              {([3, 6, 12] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.monthPill, targetMonths === m && styles.monthPillActive]}
                  onPress={() => {
                    setTargetMonths(m);
                    setEditEmergencyInput(String(monthlyEssential * m));
                  }}
                >
                  <Text style={[styles.monthPillText, targetMonths === m && styles.monthPillTextActive]}>
                    {m} Mo ({formatINR(monthlyEssential * m)})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Field 2: Investment Amount */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14} color={THEME.colors.primary} />
                <Text style={styles.inputLabel}>2. Investment Fund (₹)</Text>
              </View>
              <Text style={styles.inputSubLabel}>
                Low: {formatINR(Math.round(parsedEditInvestment * 0.3))} • High: {formatINR(Math.round(parsedEditInvestment * 0.7))}
              </Text>
            </View>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={editInvestmentInput}
              onChangeText={setEditInvestmentInput}
              placeholder="e.g. 25000"
            />
          </View>

          {/* Field 3: Savings Partition & Removal Date */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <PiggyBank size={14} color="#D97706" />
                <Text style={styles.inputLabel}>3. Savings Partition (₹)</Text>
              </View>
              <Text style={styles.inputSubLabel}>Target Goals: {formatINR(savingsTarget)}</Text>
            </View>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={editSavingsInput}
              onChangeText={setEditSavingsInput}
              placeholder="e.g. 20000"
            />

            <View style={{ marginTop: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Calendar size={12} color={THEME.colors.textMuted} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: THEME.colors.textSecondary }}>
                  Date of Removing Money (Due Date):
                </Text>
              </View>
              <TextInput
                style={[styles.textInput, { marginBottom: 4 }]}
                value={editSavingsDueDate}
                onChangeText={setEditSavingsDueDate}
                placeholder="YYYY-MM-DD (e.g. 2027-03-31)"
              />
              <Text style={{ fontSize: 9, color: THEME.colors.textMuted }}>
                Money stored in savings partition is locked and can only be removed on or after this due date.
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.editActionRow}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleResetToAuto}>
              <RotateCcw size={13} color={THEME.colors.textSecondary} />
              <Text style={styles.resetBtnText}>Auto-Suggest</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAllocations}>
              <Check size={14} color="#FFF" />
              <Text style={styles.saveBtnText}>Save Allocations</Text>
            </TouchableOpacity>
          </View>

          {saveSuccessNotice && (
            <View style={styles.successBanner}>
              <Check size={14} color="#047857" />
              <Text style={styles.successText}>Allocations saved successfully!</Text>
            </View>
          )}
        </View>
      )}

      {/* Visual Distribution Bar */}
      <View style={styles.distributionCard}>
        <View style={styles.distributionTopRow}>
          <Text style={styles.totalCashText}>
            Total Cash:{' '}
            <Text style={{ fontWeight: '800', color: THEME.colors.textPrimary }}>
              {formatINR(currentTotalCash)}
            </Text>
          </Text>
          <Text style={styles.unallocatedHighlight}>
            Unallocated:{' '}
            <Text
              style={{
                fontWeight: '800',
                color: unallocatedCash > 0 ? THEME.colors.primary : THEME.colors.textMuted,
              }}
            >
              {formatINR(unallocatedCash)}
            </Text>
          </Text>
        </View>

        <View style={styles.distributionBar}>
          {emergencyAlloc > 0 && (
            <View style={[styles.distSegment, { flex: emergencyAlloc, backgroundColor: '#37B879' }]} />
          )}
          {investmentAlloc > 0 && (
            <View
              style={[
                styles.distSegment,
                { flex: investmentAlloc, backgroundColor: THEME.colors.primary },
              ]}
            />
          )}
          {savingsAlloc > 0 && (
            <View style={[styles.distSegment, { flex: savingsAlloc, backgroundColor: '#F4A340' }]} />
          )}
          {unallocatedCash > 0 && (
            <View style={[styles.distSegment, { flex: unallocatedCash, backgroundColor: '#CBD5E1' }]} />
          )}
        </View>

        <View style={styles.legendGrid}>
          <View style={styles.legendCol}>
            <View style={[styles.dot, { backgroundColor: '#37B879' }]} />
            <Text style={styles.legendText}>Emergency: {formatINR(emergencyAlloc)}</Text>
          </View>
          <View style={styles.legendCol}>
            <View style={[styles.dot, { backgroundColor: THEME.colors.primary }]} />
            <Text style={styles.legendText}>Investments: {formatINR(investmentAlloc)}</Text>
          </View>
          <View style={styles.legendCol}>
            <View style={[styles.dot, { backgroundColor: '#F4A340' }]} />
            <Text style={styles.legendText}>Savings: {formatINR(savingsAlloc)}</Text>
          </View>
          <View style={styles.legendCol}>
            <View style={[styles.dot, { backgroundColor: '#CBD5E1' }]} />
            <Text style={styles.legendText}>Unallocated: {formatINR(unallocatedCash)}</Text>
          </View>
        </View>
      </View>

      {/* 3 INDIVIDUAL COMPARTMENT CARDS */}
      <View style={styles.compartmentsGrid}>
        {/* COMPARTMENT 1: EMERGENCY FUND */}
        <View style={styles.compartmentCard}>
          <View style={styles.compHeader}>
            <View style={[styles.compIconCircle, { backgroundColor: '#E8F8F0' }]}>
              <ShieldCheck size={16} color="#047857" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.compTitle}>Emergency Fund</Text>
              <Text style={styles.compSub}>
                {emergencyCoverageMonths} / {targetMonths} Months of Essential Expenses
              </Text>
            </View>
            <TouchableOpacity
              style={styles.cardEditBtn}
              onPress={() => handleOpenEdit('emergency')}
            >
              <Edit3 size={12} color={THEME.colors.textMuted} />
              <Text style={styles.cardEditText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.compVal}>{formatINR(emergencyAlloc)}</Text>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${emergencyPct}%`, backgroundColor: '#37B879' },
              ]}
            />
          </View>

          <View style={styles.compFooterRow}>
            <Text style={styles.compFooterText}>
              Target: {formatINR(emergencyTarget)} ({targetMonths} mo)
            </Text>
            <Text style={[styles.compFooterText, { fontWeight: '700', color: '#047857' }]}>
              {emergencyPct}% Funded
            </Text>
          </View>
        </View>

        {/* COMPARTMENT 2: INVESTMENT */}
        <View style={styles.compartmentCard}>
          <View style={styles.compHeader}>
            <View style={[styles.compIconCircle, { backgroundColor: THEME.colors.lavenderLight }]}>
              <TrendingUp size={16} color={THEME.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.compTitle}>Investments</Text>
              <Text style={styles.compSub}>Growth & Wealth Allocation</Text>
            </View>
            <TouchableOpacity
              style={styles.cardEditBtn}
              onPress={() => handleOpenEdit('investment')}
            >
              <Edit3 size={12} color={THEME.colors.textMuted} />
              <Text style={styles.cardEditText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.compVal}>{formatINR(investmentAlloc)}</Text>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(100, Math.round((investmentAlloc / Math.max(1, currentTotalCash)) * 100))}%`,
                  backgroundColor: THEME.colors.primary,
                },
              ]}
            />
          </View>

          <View style={styles.compFooterRow}>
            <Text style={styles.compFooterText}>
              Low-Risk (30%): {formatINR(Math.round(investmentAlloc * 0.3))} • High-Risk (70%):{' '}
              {formatINR(Math.round(investmentAlloc * 0.7))}
            </Text>
            {onNavigateInvestments && (
              <TouchableOpacity onPress={onNavigateInvestments}>
                <Text style={styles.compActionText}>Suggestions →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* COMPARTMENT 3: SAVINGS PARTITION */}
        <View style={styles.compartmentCard}>
          <View style={styles.compHeader}>
            <View style={[styles.compIconCircle, { backgroundColor: '#FEF6EC' }]}>
              <PiggyBank size={16} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.compTitle}>Savings Partition</Text>
              <Text style={styles.compSub}>Reserved for Financial Goals</Text>
            </View>
            <TouchableOpacity
              style={styles.cardEditBtn}
              onPress={() => handleOpenEdit('savings')}
            >
              <Edit3 size={12} color={THEME.colors.textMuted} />
              <Text style={styles.cardEditText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.compVal}>{formatINR(savingsAlloc)}</Text>

          <View style={styles.progressBarTrack}>
            <View
              style={[styles.progressBarFill, { width: `${savingsPct}%`, backgroundColor: '#F4A340' }]}
            />
          </View>

          <View style={styles.compFooterRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Lock size={10} color="#D97706" />
              <Text style={styles.compFooterText}>
                Due Date: {savingsDueDate}
              </Text>
            </View>
            {onNavigateSavings && (
              <TouchableOpacity onPress={onNavigateSavings}>
                <Text style={[styles.compActionText, { color: '#D97706' }]}>Goals →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 9,
    color: THEME.colors.textMuted,
  },
  editToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.lavenderLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editToggleBtnActive: {
    backgroundColor: THEME.colors.primary,
  },
  editToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  editCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.md,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: THEME.colors.primaryLight,
    ...THEME.shadows.card,
  },
  editCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  editCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  editCardDesc: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginBottom: 10,
    lineHeight: 14,
  },
  editLiveStats: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.borderRadius.md,
    padding: 8,
    marginBottom: 10,
    justifyContent: 'space-around',
  },
  statCol: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  statVal: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  warningText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B91C1C',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  inputSubLabel: {
    fontSize: 9,
    color: THEME.colors.textMuted,
  },
  textInput: {
    backgroundColor: THEME.colors.background,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: THEME.colors.textPrimary,
    fontWeight: '700',
  },
  targetMonthsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  monthPill: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  monthPillActive: {
    backgroundColor: THEME.colors.lavenderLight,
    borderColor: THEME.colors.primary,
  },
  monthPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  monthPillTextActive: {
    color: THEME.colors.primary,
  },
  editActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.card,
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    ...THEME.shadows.soft,
  },
  saveBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  successText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  distributionCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  distributionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalCashText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  unallocatedHighlight: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  distributionBar: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 8,
  },
  distSegment: {
    height: '100%',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  compartmentsGrid: {
    gap: 10,
  },
  compartmentCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  compHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  compIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  compSub: {
    fontSize: 9,
    color: THEME.colors.textMuted,
  },
  cardEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: THEME.colors.background,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  cardEditText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  compVal: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
  },
  compFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compFooterText: {
    fontSize: 9,
    color: THEME.colors.textMuted,
  },
  compActionText: {
    fontSize: 9,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
});
