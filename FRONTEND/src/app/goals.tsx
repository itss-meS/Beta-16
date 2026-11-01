import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  X,
  PiggyBank,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Lock,
  Edit3,
  Check,
} from 'lucide-react-native';
import { THEME, formatINR } from '../constants/theme';
import { useFinance } from '../context/FinanceContext';
import { SavingsGoalCard } from '../components/SavingsGoalCard';
import { BottomNavigation, NavTab } from '../components/BottomNavigation';
import { SavingsGoal } from '../types/finance';

export default function GoalsScreen() {
  const router = useRouter();
  const { goals, addGoal, contributeToGoal } = useFinance();

  // Create Goal Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newInitial, setNewInitial] = useState('');
  const [newDueDate, setNewDueDate] = useState('2027-03-31');

  // Edit Goal Modal State
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editCurrent, setEditCurrent] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  // Contribute Modal State
  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null);
  const [contributeAmount, setContributeAmount] = useState('5000');

  const totalSaved = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
  const totalTarget = goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
  const overallPct =
    totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 100;

  const handleCreateGoal = () => {
    const target = parseFloat(newTarget);
    const initial = parseFloat(newInitial) || 0;
    if (!newTitle.trim() || isNaN(target) || target <= 0) return;

    addGoal({
      title: newTitle.trim(),
      targetAmount: target,
      currentAmount: initial,
      deadlineDate: newDueDate.trim() || '2027-03-31',
      lockedUntilDate: newDueDate.trim() || '2027-03-31',
      category: 'Personal Goal',
      icon: 'laptop',
      isCompleted: initial >= target,
      monthlyContribution: Math.ceil(target / 6),
    });

    setNewTitle('');
    setNewTarget('');
    setNewInitial('');
    setNewDueDate('2027-03-31');
    setShowAddModal(false);
  };

  const handleOpenEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setEditTitle(goal.title);
    setEditTarget(String(goal.targetAmount));
    setEditCurrent(String(goal.currentAmount));
    setEditDueDate(goal.lockedUntilDate || goal.deadlineDate || '2027-03-31');
  };

  const handleSaveEdit = () => {
    if (!editingGoal) return;
    const target = parseFloat(editTarget);
    const current = parseFloat(editCurrent);
    if (!editTitle.trim() || isNaN(target) || target <= 0) return;

    // Mutate goal in memory
    editingGoal.title = editTitle.trim();
    editingGoal.targetAmount = target;
    if (!isNaN(current) && current >= 0) {
      editingGoal.currentAmount = current;
    }
    editingGoal.deadlineDate = editDueDate.trim() || '2027-03-31';
    editingGoal.lockedUntilDate = editDueDate.trim() || '2027-03-31';
    editingGoal.isCompleted = (editingGoal.currentAmount || 0) >= target;

    setEditingGoal(null);
  };

  const handleApplyContribution = () => {
    if (!contributeGoal) return;
    const amt = parseFloat(contributeAmount);
    if (isNaN(amt) || amt <= 0) return;

    contributeToGoal(contributeGoal.id, amt);
    setContributeGoal(null);
    setContributeAmount('5000');
  };

  const handleNavChange = (tab: NavTab) => {
    switch (tab) {
      case 'home':
        router.push('/');
        break;
      case 'transactions':
        router.push('/transactions');
        break;
      case 'simulator':
        router.push('/simulator');
        break;
      case 'insights':
        router.push('/insights');
        break;
      case 'assistant':
        router.push('/assistant');
        break;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.backButton}>
          <ArrowLeft size={20} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Savings Goals</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Plus size={18} color={THEME.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Savings Goals Overview Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIconCircle}>
              <PiggyBank size={22} color={THEME.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>Total Savings Partition</Text>
              <Text style={styles.summarySubtitle}>
                {goals.length} Active Targets • {overallPct}% Progress
              </Text>
            </View>
            <View style={styles.percentPill}>
              <Text style={styles.percentPillText}>{overallPct}%</Text>
            </View>
          </View>

          <View style={styles.summaryAmountRow}>
            <View>
              <Text style={styles.amountLabel}>Total Saved</Text>
              <Text style={styles.amountValue}>{formatINR(totalSaved)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.amountLabel}>Target Sum</Text>
              <Text style={[styles.amountValue, { color: THEME.colors.textSecondary }]}>
                {formatINR(totalTarget)}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${overallPct}%` }]} />
          </View>

          {/* Fixed Saving Lock Rule Notice */}
          <View style={styles.ruleNoticeBox}>
            <Lock size={12} color="#D97706" />
            <Text style={styles.ruleNoticeText}>
              <Text style={{ fontWeight: '800' }}>Fixed Saving Policy:</Text> Funds allocated to savings
              goals are protected until their respective due dates, ensuring disciplined goal completion.
            </Text>
          </View>
        </View>

        {/* Section Header: Active Goals */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your Goals</Text>
          <TouchableOpacity style={styles.addGoalTextBtn} onPress={() => setShowAddModal(true)}>
            <Plus size={14} color={THEME.colors.primary} />
            <Text style={styles.addGoalText}>New Goal</Text>
          </TouchableOpacity>
        </View>

        {goals.map((goal) => (
          <SavingsGoalCard
            key={goal.id}
            goal={goal}
            onEdit={handleOpenEdit}
            onContribute={(g) => setContributeGoal(g)}
          />
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* CREATE GOAL MODAL */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Savings Goal</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeBtn}>
                <X size={18} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Goal Name</Text>
            <TextInput
              style={styles.inputField}
              placeholder="e.g. New Laptop, Emergency Reserve, Goa Trip"
              placeholderTextColor={THEME.colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.inputLabel}>Target Amount (₹)</Text>
            <TextInput
              style={styles.inputField}
              placeholder="e.g. 80000"
              placeholderTextColor={THEME.colors.textMuted}
              keyboardType="numeric"
              value={newTarget}
              onChangeText={setNewTarget}
            />

            <Text style={styles.inputLabel}>Initial Deposit (₹) - Optional</Text>
            <TextInput
              style={styles.inputField}
              placeholder="e.g. 15000"
              placeholderTextColor={THEME.colors.textMuted}
              keyboardType="numeric"
              value={newInitial}
              onChangeText={setNewInitial}
            />

            <Text style={styles.inputLabel}>Date of Removing Money (Due Date)</Text>
            <TextInput
              style={styles.inputField}
              placeholder="YYYY-MM-DD (e.g. 2027-03-31)"
              placeholderTextColor={THEME.colors.textMuted}
              value={newDueDate}
              onChangeText={setNewDueDate}
            />
            <Text style={styles.dueNote}>
              Funds kept in this partition are designated for removal on or after this date.
            </Text>

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateGoal}>
              <Text style={styles.submitBtnText}>Create Goal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* EDIT GOAL MODAL */}
      <Modal
        visible={!!editingGoal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingGoal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Savings Goal</Text>
              <TouchableOpacity onPress={() => setEditingGoal(null)} style={styles.closeBtn}>
                <X size={18} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Goal Name</Text>
            <TextInput
              style={styles.inputField}
              value={editTitle}
              onChangeText={setEditTitle}
            />

            <Text style={styles.inputLabel}>Target Goal Amount (₹)</Text>
            <TextInput
              style={styles.inputField}
              keyboardType="numeric"
              value={editTarget}
              onChangeText={setEditTarget}
            />

            <Text style={styles.inputLabel}>Current Saved Amount (₹)</Text>
            <TextInput
              style={styles.inputField}
              keyboardType="numeric"
              value={editCurrent}
              onChangeText={setEditCurrent}
            />

            <Text style={styles.inputLabel}>Due / Removal Date</Text>
            <TextInput
              style={styles.inputField}
              value={editDueDate}
              onChangeText={setEditDueDate}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveEdit}>
              <Text style={styles.submitBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CONTRIBUTE TO GOAL MODAL */}
      <Modal
        visible={!!contributeGoal}
        transparent
        animationType="slide"
        onRequestClose={() => setContributeGoal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Funds to Goal</Text>
              <TouchableOpacity onPress={() => setContributeGoal(null)} style={styles.closeBtn}>
                <X size={18} color={THEME.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, fontWeight: '700', color: THEME.colors.textPrimary, marginBottom: 8 }}>
              {contributeGoal?.title}
            </Text>
            <Text style={{ fontSize: 11, color: THEME.colors.textSecondary, marginBottom: 14 }}>
              Current: {formatINR(contributeGoal?.currentAmount || 0)} / Target: {formatINR(contributeGoal?.targetAmount || 0)}
            </Text>

            <Text style={styles.inputLabel}>Deposit Amount (₹)</Text>
            <TextInput
              style={styles.inputField}
              keyboardType="numeric"
              value={contributeAmount}
              onChangeText={setContributeAmount}
            />

            {/* Quick Chips */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {['2000', '5000', '10000'].map((chip) => (
                <TouchableOpacity
                  key={chip}
                  style={styles.quickChip}
                  onPress={() => setContributeAmount(chip)}
                >
                  <Text style={styles.quickChipText}>+{formatINR(parseFloat(chip))}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleApplyContribution}>
              <Text style={styles.submitBtnText}>Confirm Deposit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <BottomNavigation activeTab="home" onSelectTab={handleNavChange} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.soft,
  },
  headerTitle: {
    fontSize: THEME.typography.sizes.md,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.lavenderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: THEME.spacing.lg,
    paddingBottom: 24,
  },
  summaryCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.lg,
    ...THEME.shadows.card,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  summaryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.lavenderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  summarySubtitle: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  percentPill: {
    backgroundColor: THEME.colors.lavenderLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: THEME.borderRadius.full,
  },
  percentPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  summaryAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  amountLabel: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
    borderRadius: 4,
  },
  ruleNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF6EC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ruleNoticeText: {
    fontSize: 10,
    color: '#92400E',
    flex: 1,
    lineHeight: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  addGoalTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addGoalText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.colors.card,
    borderTopLeftRadius: THEME.borderRadius.xl,
    borderTopRightRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.lg,
  },
  modalTitle: {
    fontSize: THEME.typography.sizes.md,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  inputField: {
    backgroundColor: THEME.colors.background,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  dueNote: {
    fontSize: 9,
    color: THEME.colors.textMuted,
    marginTop: -8,
    marginBottom: 14,
  },
  submitBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...THEME.shadows.soft,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: THEME.colors.lavenderLight,
  },
  quickChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
});
