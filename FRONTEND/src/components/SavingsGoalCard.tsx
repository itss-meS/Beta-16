import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Laptop, Shield, Compass, Edit3, Plus, Lock, Calendar } from 'lucide-react-native';
import { THEME, formatINR } from '../constants/theme';
import { SavingsGoal } from '../types/finance';

interface Props {
  goal: SavingsGoal;
  onEdit?: (goal: SavingsGoal) => void;
  onContribute?: (goal: SavingsGoal) => void;
}

export const SavingsGoalCard: React.FC<Props> = ({ goal, onEdit, onContribute }) => {
  const percentage = Math.min(
    100,
    Math.round((goal.currentAmount / Math.max(1, goal.targetAmount)) * 100)
  );

  const renderIcon = () => {
    switch (goal.icon) {
      case 'laptop':
        return <Laptop size={18} color={THEME.colors.primary} />;
      case 'shield':
        return <Shield size={18} color={THEME.colors.success} />;
      default:
        return <Compass size={18} color={THEME.colors.warning} />;
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.leftInfo}>
          <View style={styles.iconCircle}>{renderIcon()}</View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{goal.title}</Text>
            <Text style={styles.amountText}>
              {formatINR(goal.currentAmount)} of {formatINR(goal.targetAmount)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={styles.percentBadge}>
            <Text style={styles.percentText}>{percentage}%</Text>
          </View>
          {onEdit && (
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => onEdit(goal)}
              activeOpacity={0.7}
            >
              <Edit3 size={13} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percentage}%` }]} />
      </View>

      <View style={styles.footerRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Calendar size={11} color={THEME.colors.textMuted} />
            <Text style={styles.targetDateText}>
              Target: {goal.deadlineDate} • +{formatINR(goal.monthlyContribution)}/mo
            </Text>
          </View>
          {goal.lockedUntilDate && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Lock size={10} color="#D97706" />
              <Text style={styles.lockDateText}>
                Locked until due date: {goal.lockedUntilDate}
              </Text>
            </View>
          )}
        </View>

        {onContribute && (
          <TouchableOpacity
            style={styles.contributeBtn}
            onPress={() => onContribute(goal)}
            activeOpacity={0.8}
          >
            <Plus size={12} color={THEME.colors.primary} />
            <Text style={styles.contributeBtnText}>Add Funds</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.sm,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.lavenderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  amountText: {
    fontSize: THEME.typography.sizes.xs,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  percentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.lavenderLight,
  },
  percentText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.background,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: THEME.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  targetDateText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  lockDateText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#D97706',
  },
  contributeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: THEME.colors.lavenderLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  contributeBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
});
