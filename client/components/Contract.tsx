"use client";

import { useState, useCallback, useEffect } from "react";
import {
  createPoll,
  addOption,
  vote,
  getPoll,
  getPollIds,
  hasVoted,
  CONTRACT_ADDRESS,
  type Poll,
} from "@/hooks/contract";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Spotlight } from "@/components/ui/spotlight";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Icons ────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function VoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function PollIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  );
}

// ── Styled Input ─────────────────────────────────────────────

function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">
        {label}
      </label>
      <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#7c6cf0]/30 focus-within:shadow-[0_0_20px_rgba(124,108,240,0.08)]">
        <input
          {...props}
          className="w-full rounded-[11px] bg-transparent px-4 py-3 font-mono text-sm text-white/90 placeholder:text-white/15 outline-none"
        />
      </div>
    </div>
  );
}

// ── Method Signature ─────────────────────────────────────────

function MethodSignature({
  name,
  params,
  returns,
  color,
}: {
  name: string;
  params: string;
  returns?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 font-mono text-sm">
      <span style={{ color }} className="font-semibold">fn</span>
      <span className="text-white/70">{name}</span>
      <span className="text-white/20 text-xs">{params}</span>
      {returns && (
        <span className="ml-auto text-white/15 text-[10px]">{returns}</span>
      )}
    </div>
  );
}

// ── Poll Card ────────────────────────────────────────────────

function PollCard({
  poll,
  pollId,
  walletAddress,
  onVote,
  hasVoted: userHasVoted,
  isVoting,
  selectedOption,
  onSelectOption,
}: {
  poll: Poll;
  pollId: number;
  walletAddress: string | null;
  onVote: () => void;
  hasVoted: boolean;
  isVoting: boolean;
  selectedOption: number | null;
  onSelectOption: (index: number) => void;
}) {
  const totalVotes = poll.votes.reduce((acc, v) => acc + Number(v), 0);
  const maxVotes = Math.max(...poll.votes.map(v => Number(v)), 1);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-fade-in-up">
      <div className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">Poll #{pollId}</span>
        <Badge variant="info" className="text-[10px]">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </Badge>
      </div>
      <div className="p-4 space-y-4">
        <h4 className="text-base font-semibold text-white/90">{poll.question}</h4>
        
        <div className="space-y-2">
          {poll.options.map((option, index) => {
            const votes = Number(poll.votes[index] || 0);
            const percentage = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
            const isSelected = selectedOption === index;
            const isWinner = votes === maxVotes && totalVotes > 0;

            return (
              <button
                key={index}
                onClick={() => onSelectOption(index)}
                disabled={!walletAddress || userHasVoted}
                className={cn(
                  "relative w-full rounded-lg border px-4 py-3 text-left transition-all overflow-hidden",
                  isSelected && !userHasVoted
                    ? "border-[#7c6cf0]/40 bg-[#7c6cf0]/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]",
                  (userHasVoted || !walletAddress) && "cursor-default"
                )}
              >
                {/* Progress bar */}
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all",
                    isWinner ? "bg-[#34d399]/10" : "bg-white/[0.03]"
                  )}
                  style={{ width: `${percentage}%` }}
                />
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isSelected && !userHasVoted && (
                      <span className="h-4 w-4 rounded-full border-2 border-[#7c6cf0] bg-[#7c6cf0]/20 flex items-center justify-center">
                        <span className="h-2 w-2 rounded-full bg-[#7c6cf0]" />
                      </span>
                    )}
                    {userHasVoted && isWinner && (
                      <span className="text-[#34d399]"><CheckIcon /></span>
                    )}
                    <span className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-white/90" : "text-white/70"
                    )}>
                      {option}
                    </span>
                  </div>
                  <span className={cn(
                    "text-sm font-mono",
                    isWinner ? "text-[#34d399]" : "text-white/40"
                  )}>
                    {votes}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {walletAddress && !userHasVoted && (
          <ShimmerButton
            onClick={onVote}
            disabled={isVoting || selectedOption === null}
            shimmerColor="#7c6cf0"
            className="w-full"
          >
            {isVoting ? (
              <><SpinnerIcon /> Submitting vote...</>
            ) : (
              <><VoteIcon /> Cast Vote</>
            )}
          </ShimmerButton>
        )}

        {userHasVoted && (
          <div className="flex items-center justify-center gap-2 py-2 text-[#34d399] text-sm">
            <CheckIcon />
            <span>You have voted</span>
          </div>
        )}

        {!walletAddress && (
          <p className="text-center text-xs text-white/30 py-2">
            Connect wallet to vote
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

type Tab = "polls" | "create" | "addOption";

interface ContractUIProps {
  walletAddress: string | null;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function ContractUI({ walletAddress, onConnect, isConnecting }: ContractUIProps) {
  const [activeTab, setActiveTab] = useState<Tab>("polls");
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Create Poll state
  const [newQuestion, setNewQuestion] = useState("");
  const [newOptions, setNewOptions] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Add Option state
  const [addOptionPollId, setAddOptionPollId] = useState("");
  const [addOptionText, setAddOptionText] = useState("");
  const [isAddingOption, setIsAddingOption] = useState(false);

  // View Polls state
  const [pollIds, setPollIds] = useState<number[]>([]);
  const [polls, setPolls] = useState<Map<number, Poll>>(new Map());
  const [votedPolls, setVotedPolls] = useState<Map<number, boolean>>(new Map());
  const [isLoadingPolls, setIsLoadingPolls] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Map<number, number>>(new Map());
  const [votingPollId, setVotingPollId] = useState<number | null>(null);

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Load polls
  const loadPolls = useCallback(async () => {
    setIsLoadingPolls(true);
    try {
      const ids = await getPollIds();
      setPollIds(ids);

      const pollMap = new Map<number, Poll>();
      for (const id of ids) {
        const poll = await getPoll(id);
        if (poll) {
          pollMap.set(id, poll);
        }
      }
      setPolls(pollMap);

      // Check voted status for each poll
      if (walletAddress) {
        const votedMap = new Map<number, boolean>();
        for (const id of ids) {
          const hasVoted_ = await hasVoted(walletAddress, id);
          votedMap.set(id, hasVoted_);
        }
        setVotedPolls(votedMap);
      }
    } catch (err: unknown) {
      console.error("Failed to load polls:", err);
    } finally {
      setIsLoadingPolls(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (activeTab === "polls") {
      loadPolls();
      // Refresh every 10 seconds
      const interval = setInterval(loadPolls, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadPolls]);

  // Create Poll handler
  const handleCreatePoll = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!newQuestion.trim()) return setError("Enter a question");
    
    const options = newOptions.split(",").map(o => o.trim()).filter(o => o);
    if (options.length < 2) return setError("Enter at least 2 options separated by commas");

    setError(null);
    setIsCreating(true);
    setTxStatus("Awaiting signature...");
    try {
      await createPoll(walletAddress, newQuestion.trim(), options);
      setTxStatus("Poll created on-chain!");
      setNewQuestion("");
      setNewOptions("");
      setActiveTab("polls");
      setTimeout(() => {
        setTxStatus(null);
        loadPolls();
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsCreating(false);
    }
  }, [walletAddress, newQuestion, newOptions, loadPolls]);

  // Add Option handler
  const handleAddOption = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    const pollId = parseInt(addOptionPollId);
    if (isNaN(pollId)) return setError("Enter a valid poll ID");
    if (!addOptionText.trim()) return setError("Enter an option");

    setError(null);
    setIsAddingOption(true);
    setTxStatus("Awaiting signature...");
    try {
      await addOption(walletAddress, pollId, addOptionText.trim());
      setTxStatus("Option added on-chain!");
      setAddOptionPollId("");
      setAddOptionText("");
      setTimeout(() => {
        setTxStatus(null);
        loadPolls();
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsAddingOption(false);
    }
  }, [walletAddress, addOptionPollId, addOptionText, loadPolls]);

  // Vote handler
  const handleVote = useCallback(async (pollId: number) => {
    if (!walletAddress) return setError("Connect wallet first");
    const optionIndex = selectedOptions.get(pollId);
    if (optionIndex === undefined) return setError("Select an option first");

    setError(null);
    setVotingPollId(pollId);
    setTxStatus("Awaiting signature...");
    try {
      await vote(walletAddress, pollId, optionIndex);
      setTxStatus("Vote submitted!");
      setTimeout(() => {
        setTxStatus(null);
        loadPolls();
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setVotingPollId(null);
    }
  }, [walletAddress, selectedOptions, loadPolls]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "polls", label: "Vote", icon: <PollIcon />, color: "#7c6cf0" },
    { key: "create", label: "Create", icon: <PlusIcon />, color: "#34d399" },
    { key: "addOption", label: "Add Option", icon: <VoteIcon />, color: "#fbbf24" },
  ];

  return (
    <div className="w-full max-w-2xl animate-fade-in-up-delayed">
      {/* Toasts */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#f87171]/15 bg-[#f87171]/[0.05] px-4 py-3 backdrop-blur-sm animate-slide-down">
          <span className="mt-0.5 text-[#f87171]"><AlertIcon /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#f87171]/90">Error</p>
            <p className="text-xs text-[#f87171]/50 mt-0.5 break-all">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="shrink-0 text-[#f87171]/30 hover:text-[#f87171]/70 text-lg leading-none">&times;</button>
        </div>
      )}

      {txStatus && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#34d399]/15 bg-[#34d399]/[0.05] px-4 py-3 backdrop-blur-sm shadow-[0_0_30px_rgba(52,211,153,0.05)] animate-slide-down">
          <span className="text-[#34d399]">
            {txStatus.includes("on-chain") || txStatus.includes("submitted") ? <CheckIcon /> : <SpinnerIcon />}
          </span>
          <span className="text-sm text-[#34d399]/90">{txStatus}</span>
        </div>
      )}

      {/* Main Card */}
      <Spotlight className="rounded-2xl">
        <AnimatedCard className="p-0" containerClassName="rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf0]/20 to-[#34d399]/20 border border-white/[0.06]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#7c6cf0]">
                  <path d="M18 20V10" />
                  <path d="M12 20V4" />
                  <path d="M6 20v-6" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90">Permissionless Voting</h3>
                <p className="text-[10px] text-white/25 font-mono mt-0.5">{truncate(CONTRACT_ADDRESS)}</p>
              </div>
            </div>
            <Badge variant="success" className="text-[10px]">Open</Badge>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setError(null); }}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all",
                  activeTab === t.key ? "text-white/90" : "text-white/35 hover:text-white/55"
                )}
              >
                <span style={activeTab === t.key ? { color: t.color } : undefined}>{t.icon}</span>
                {t.label}
                {activeTab === t.key && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full transition-all"
                    style={{ background: `linear-gradient(to right, ${t.color}, ${t.color}66)` }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* View Polls */}
            {activeTab === "polls" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <MethodSignature name="get_polls" params="()" returns="-> Vec<Poll>" color="#7c6cf0" />
                  <button
                    onClick={loadPolls}
                    disabled={isLoadingPolls}
                    className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                  >
                    <RefreshIcon />
                  </button>
                </div>

                {isLoadingPolls ? (
                  <div className="flex items-center justify-center py-8">
                    <SpinnerIcon />
                    <span className="ml-2 text-sm text-white/40">Loading polls...</span>
                  </div>
                ) : pollIds.length === 0 ? (
                  <div className="text-center py-8 text-white/30">
                    <p>No polls yet.</p>
                    <p className="text-xs mt-1">Be the first to create one!</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                    {[...pollIds].reverse().map((pollId) => {
                      const poll = polls.get(pollId);
                      if (!poll) return null;
                      return (
                        <PollCard
                          key={pollId}
                          poll={poll}
                          pollId={pollId}
                          walletAddress={walletAddress}
                          onVote={() => handleVote(pollId)}
                          hasVoted={votedPolls.get(pollId) || false}
                          isVoting={votingPollId === pollId}
                          selectedOption={selectedOptions.get(pollId) ?? null}
                          onSelectOption={(index) => {
                            setSelectedOptions(new Map(selectedOptions.set(pollId, index)));
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Create Poll */}
            {activeTab === "create" && (
              <div className="space-y-5">
                <MethodSignature name="create_poll" params="(question: String, options: Vec<String>)" returns="-> u32" color="#34d399" />
                <Input
                  label="Question"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="e.g. What should we build next?"
                />
                <Input
                  label="Options (comma separated)"
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                  placeholder="e.g. Rust SDK, TypeScript SDK, Go SDK"
                />
                {walletAddress ? (
                  <ShimmerButton onClick={handleCreatePoll} disabled={isCreating} shimmerColor="#34d399" className="w-full">
                    {isCreating ? <><SpinnerIcon /> Creating...</> : <><PlusIcon /> Create Poll</>}
                  </ShimmerButton>
                ) : (
                  <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="w-full rounded-xl border border-dashed border-[#34d399]/20 bg-[#34d399]/[0.03] py-4 text-sm text-[#34d399]/60 hover:border-[#34d399]/30 hover:text-[#34d399]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    Connect wallet to create polls
                  </button>
                )}
              </div>
            )}

            {/* Add Option */}
            {activeTab === "addOption" && (
              <div className="space-y-5">
                <MethodSignature name="add_option" params="(poll_id: u32, option: String)" color="#fbbf24" />
                <Input
                  label="Poll ID"
                  type="number"
                  value={addOptionPollId}
                  onChange={(e) => setAddOptionPollId(e.target.value)}
                  placeholder="e.g. 1"
                />
                <Input
                  label="New Option"
                  value={addOptionText}
                  onChange={(e) => setAddOptionText(e.target.value)}
                  placeholder="e.g. Python SDK"
                />
                {walletAddress ? (
                  <ShimmerButton onClick={handleAddOption} disabled={isAddingOption} shimmerColor="#fbbf24" className="w-full">
                    {isAddingOption ? <><SpinnerIcon /> Adding...</> : <><PlusIcon /> Add Option</>}
                  </ShimmerButton>
                ) : (
                  <button
                    onClick={onConnect}
                    disabled={isConnecting}
                    className="w-full rounded-xl border border-dashed border-[#fbbf24]/20 bg-[#fbbf24]/[0.03] py-4 text-sm text-[#fbbf24]/60 hover:border-[#fbbf24]/30 hover:text-[#fbbf24]/80 active:scale-[0.99] transition-all disabled:opacity-50"
                  >
                    Connect wallet to add options
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.04] px-6 py-3 flex items-center justify-between">
            <p className="text-[10px] text-white/15">Permissionless Voting &middot; Soroban</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/15">Anyone can create polls &amp; vote</span>
            </div>
          </div>
        </AnimatedCard>
      </Spotlight>
    </div>
  );
}
