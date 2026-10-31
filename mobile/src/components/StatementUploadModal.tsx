import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  FileSpreadsheet,
  UploadCloud,
  FileText,
  CheckCircle2,
  X,
  Sparkles,
  ShieldCheck,
  Building2,
  MessageSquare,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  AlertCircle,
} from 'lucide-react-native';
import { THEME, formatINR } from '../constants/theme';
import {
  parseOfflineStatementCSV,
  SAMPLE_STATEMENTS,
  ParsedStatementResult,
} from '../services/statementParser';
import { Transaction } from '../types/finance';

interface Props {
  visible: boolean;
  onClose: () => void;
  onImportComplete: (transactions: Transaction[]) => void;
}

export const StatementUploadModal: React.FC<Props> = ({
  visible,
  onClose,
  onImportComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'sample' | 'custom' | 'sms'>('sample');
  const [customCsv, setCustomCsv] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedStatementResult | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const handleSelectSample = (csvText: string) => {
    const result = parseOfflineStatementCSV(csvText);
    setParsedResult(result);
  };

  const handleParseCustom = () => {
    if (!customCsv.trim()) return;
    const result = parseOfflineStatementCSV(customCsv);
    setParsedResult(result);
  };

  const handleSimulateSMS = () => {
    const smsData = `Date,Narration,Withdrawal,Deposit
2026-10-28,UPI-Chai Point Tech Park,450,0
2026-10-29,IMPS-Freelance Design Milestone,0,15000
2026-10-30,UPI-Swiggy Instamart Grocery,680,0
2026-10-30,UPI-Ola Electric Ride,220,0`;
    const result = parseOfflineStatementCSV(smsData);
    setParsedResult(result);
  };

  const handleConfirmImport = () => {
    if (!parsedResult || parsedResult.transactions.length === 0) return;
    onImportComplete(parsedResult.transactions);
    setImportSuccess(true);
    setTimeout(() => {
      setImportSuccess(false);
      setParsedResult(null);
      setCustomCsv('');
      onClose();
    }, 1400);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Import Bank Statement</Text>
              <View style={styles.privacyPill}>
                <ShieldCheck size={12} color={THEME.colors.success} />
                <Text style={styles.privacyText}>100% On-Device • Zero Cloud Transmission</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Source Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'sample' && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab('sample');
                setParsedResult(null);
              }}
            >
              <Sparkles size={14} color={activeTab === 'sample' ? '#FFF' : THEME.colors.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'sample' && styles.tabTextActive]}>
                Sample Banks
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'custom' && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab('custom');
                setParsedResult(null);
              }}
            >
              <FileSpreadsheet size={14} color={activeTab === 'custom' ? '#FFF' : THEME.colors.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'custom' && styles.tabTextActive]}>
                Upload CSV
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'sms' && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab('sms');
                setParsedResult(null);
              }}
            >
              <MessageSquare size={14} color={activeTab === 'sms' ? '#FFF' : THEME.colors.textSecondary} />
              <Text style={[styles.tabText, activeTab === 'sms' && styles.tabTextActive]}>
                SMS / UPI
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* TAB 1: SAMPLE STATEMENTS */}
            {activeTab === 'sample' && (
              <View style={styles.section}>
                <Text style={styles.sectionSubtitle}>
                  Choose a realistic Indian bank statement to parse and import into your local budget:
                </Text>

                {SAMPLE_STATEMENTS.map((stmt) => (
                  <TouchableOpacity
                    key={stmt.id}
                    style={styles.sampleCard}
                    onPress={() => handleSelectSample(stmt.csv)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.sampleCardHeader}>
                      <View style={styles.bankIdentity}>
                        <View style={styles.bankIconCircle}>
                          <Building2 size={16} color={THEME.colors.primary} />
                        </View>
                        <View>
                          <Text style={styles.sampleBankTitle}>{stmt.title}</Text>
                          <Text style={styles.sampleAccountNum}>{stmt.accountNumber} • {stmt.dateRange}</Text>
                        </View>
                      </View>
                      <ArrowRight size={16} color={THEME.colors.primary} />
                    </View>
                    <Text style={styles.sampleSummaryText}>{stmt.summary}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* TAB 2: CUSTOM CSV */}
            {activeTab === 'custom' && (
              <View style={styles.section}>
                <Text style={styles.sectionSubtitle}>
                  Paste bank statement CSV lines (e.g. from HDFC, SBI, ICICI internet banking):
                </Text>

                <TextInput
                  style={styles.csvTextArea}
                  multiline
                  numberOfLines={6}
                  placeholder={`Date,Narration,Withdrawal,Deposit\n2026-10-15,UPI-Swiggy Gourmet,850,0\n2026-10-16,TechCorp Salary Credit,0,50000\n2026-10-18,ACH-BESCOM Electricity,1250,0`}
                  placeholderTextColor={THEME.colors.textMuted}
                  value={customCsv}
                  onChangeText={setCustomCsv}
                />

                <TouchableOpacity
                  style={[styles.parseBtn, !customCsv.trim() && styles.parseBtnDisabled]}
                  onPress={handleParseCustom}
                  disabled={!customCsv.trim()}
                >
                  <FileSpreadsheet size={16} color="#FFF" />
                  <Text style={styles.parseBtnText}>Parse Offline CSV</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 3: SMS SYNC */}
            {activeTab === 'sms' && (
              <View style={styles.section}>
                <View style={styles.smsInfoCard}>
                  <MessageSquare size={20} color={THEME.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.smsCardTitle}>On-Device SMS Statement Sync</Text>
                    <Text style={styles.smsCardSub}>
                      Extracts transactional debit and credit alerts from your bank messages (HDFC, SBI, PhonePe, Google Pay). No messages leave your phone.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.parseBtn}
                  onPress={handleSimulateSMS}
                >
                  <Sparkles size={16} color="#FFF" />
                  <Text style={styles.parseBtnText}>Scan Recent UPI SMS Alerts</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* PARSED PREVIEW SECTION */}
            {parsedResult && (
              <View style={styles.previewContainer}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewTitle}>Statement Preview</Text>
                  <View style={styles.recordsBadge}>
                    <Text style={styles.recordsBadgeText}>
                      {parsedResult.totalRecords} Transactions Found
                    </Text>
                  </View>
                </View>

                <View style={styles.previewMetricsRow}>
                  <View style={styles.previewMetricCard}>
                    <View style={styles.metricIconWrap}>
                      <TrendingUp size={14} color={THEME.colors.success} />
                    </View>
                    <View>
                      <Text style={styles.metricLabel}>Total Credits</Text>
                      <Text style={[styles.metricVal, { color: THEME.colors.success }]}>
                        +{formatINR(parsedResult.totalCredits)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.previewMetricCard}>
                    <View style={styles.metricIconWrap}>
                      <TrendingDown size={14} color={THEME.colors.danger} />
                    </View>
                    <View>
                      <Text style={styles.metricLabel}>Total Debits</Text>
                      <Text style={[styles.metricVal, { color: THEME.colors.danger }]}>
                        −{formatINR(parsedResult.totalDebits)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.previewList}>
                  {parsedResult.transactions.slice(0, 4).map((tx, idx) => (
                    <View key={idx} style={styles.previewItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.previewTxTitle} numberOfLines={1}>
                          {tx.title}
                        </Text>
                        <Text style={styles.previewTxMeta}>
                          {tx.category} • {tx.date} • {tx.paymentMethod}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.previewTxAmount,
                          tx.type === 'INCOME' ? { color: THEME.colors.success } : { color: THEME.colors.textPrimary },
                        ]}
                      >
                        {tx.type === 'INCOME' ? '+' : '−'}
                        {formatINR(tx.amount)}
                      </Text>
                    </View>
                  ))}
                  {parsedResult.transactions.length > 4 && (
                    <Text style={styles.moreItemsText}>
                      +{parsedResult.transactions.length - 4} more transactions will be imported
                    </Text>
                  )}
                </View>

                {importSuccess ? (
                  <View style={styles.successBox}>
                    <CheckCircle2 size={18} color={THEME.colors.success} />
                    <Text style={styles.successText}>Successfully imported into local storage!</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.confirmImportBtn}
                    onPress={handleConfirmImport}
                    activeOpacity={0.85}
                  >
                    <CheckCircle2 size={18} color="#FFF" />
                    <Text style={styles.confirmImportBtnText}>
                      Import {parsedResult.totalRecords} Transactions to Local Storage
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 23, 37, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.colors.card,
    borderTopLeftRadius: THEME.borderRadius.xl,
    borderTopRightRadius: THEME.borderRadius.xl,
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.lg,
    paddingBottom: 24,
    maxHeight: '88%',
    ...THEME.shadows.hover,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.md,
  },
  title: {
    fontSize: THEME.typography.sizes.base,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  privacyText: {
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.success,
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.lavenderLight,
    padding: 3,
    borderRadius: THEME.borderRadius.full,
    marginBottom: THEME.spacing.md,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: THEME.borderRadius.full,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: THEME.colors.primary,
    ...THEME.shadows.soft,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  bodyScroll: {
    maxHeight: 460,
  },
  section: {
    marginBottom: THEME.spacing.md,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
    lineHeight: 16,
  },
  sampleCard: {
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  sampleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bankIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bankIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.lavenderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleBankTitle: {
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  sampleAccountNum: {
    fontSize: 10,
    color: THEME.colors.textMuted,
  },
  sampleSummaryText: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    lineHeight: 14,
    marginTop: 2,
  },
  csvTextArea: {
    backgroundColor: THEME.colors.background,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.md,
    fontSize: 11,
    fontFamily: 'Courier',
    color: THEME.colors.textPrimary,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: THEME.spacing.md,
  },
  parseBtn: {
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
    ...THEME.shadows.soft,
  },
  parseBtnDisabled: {
    backgroundColor: '#C8B5F9',
  },
  parseBtnText: {
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
    color: '#FFF',
  },
  smsInfoCard: {
    flexDirection: 'row',
    backgroundColor: '#FAF5FF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    gap: THEME.spacing.md,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: THEME.spacing.md,
  },
  smsCardTitle: {
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
    color: '#6B21A8',
  },
  smsCardSub: {
    fontSize: 10,
    color: '#7E22CE',
    lineHeight: 15,
    marginTop: 2,
  },
  previewContainer: {
    backgroundColor: '#FAF9FE',
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.base,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    marginTop: THEME.spacing.sm,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: THEME.spacing.md,
  },
  previewTitle: {
    fontSize: THEME.typography.sizes.sm,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  recordsBadge: {
    backgroundColor: THEME.colors.lavenderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.full,
  },
  recordsBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  previewMetricsRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  previewMetricCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    padding: THEME.spacing.sm,
    gap: 8,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 9,
    color: THEME.colors.textSecondary,
  },
  metricVal: {
    fontSize: 11,
    fontWeight: '800',
  },
  previewList: {
    gap: 6,
    marginBottom: THEME.spacing.md,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.card,
    padding: 8,
    borderRadius: THEME.borderRadius.sm,
  },
  previewTxTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  previewTxMeta: {
    fontSize: 9,
    color: THEME.colors.textMuted,
  },
  previewTxAmount: {
    fontSize: 11,
    fontWeight: '700',
  },
  moreItemsText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  confirmImportBtn: {
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.lg,
    ...THEME.shadows.soft,
  },
  confirmImportBtnText: {
    fontSize: THEME.typography.sizes.xs,
    fontWeight: '700',
    color: '#FFF',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E8F8F0',
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.md,
  },
  successText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.success,
  },
});
