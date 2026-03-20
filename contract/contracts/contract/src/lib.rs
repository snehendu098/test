#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone)]
pub struct Poll {
    pub question: String,
    pub options: Vec<String>,
    pub votes: Vec<i128>,
    pub creator: Address,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Poll(u32),
    HasVoted(u32, Address),
    PollIds,
    PollCount,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Create a new poll with initial options. Returns poll ID.
    pub fn create_poll(env: Env, question: String, options: Vec<String>) -> u32 {
        let poll_id = Self::next_id(&env);

        let mut votes = Vec::new(&env);
        for _ in 0..options.len() {
            votes.push_back(0i128);
        }

        let poll = Poll {
            question,
            options,
            votes,
            creator: env.current_contract_address(),
            created_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Poll(poll_id), &poll);

        let mut ids = Self::get_poll_ids_internal(&env);
        ids.push_back(poll_id);
        env.storage().persistent().set(&DataKey::PollIds, &ids);

        poll_id
    }

    /// Add a new option to an existing poll - permissionless
    pub fn add_option(env: Env, poll_id: u32, option: String) {
        let mut poll: Poll = env
            .storage()
            .persistent()
            .get(&DataKey::Poll(poll_id))
            .expect("Poll not found");

        poll.options.push_back(option);
        poll.votes.push_back(0i128);

        env.storage()
            .persistent()
            .set(&DataKey::Poll(poll_id), &poll);
    }

    /// Vote for an option in a poll - requires auth
    pub fn vote(env: Env, voter: Address, poll_id: u32, option_index: u32) {
        voter.require_auth();

        let mut poll: Poll = env
            .storage()
            .persistent()
            .get(&DataKey::Poll(poll_id))
            .expect("Poll not found");

        assert!(
            !env.storage()
                .persistent()
                .has(&DataKey::HasVoted(poll_id, voter.clone())),
            "Already voted"
        );

        assert!(option_index < poll.votes.len(), "Invalid option index");

        poll.votes
            .set(option_index, poll.votes.get(option_index).unwrap() + 1);
        env.storage()
            .persistent()
            .set(&DataKey::Poll(poll_id), &poll);
        env.storage()
            .persistent()
            .set(&DataKey::HasVoted(poll_id, voter), &true);
    }

    /// Get poll details with current vote counts
    pub fn get_poll(env: Env, poll_id: u32) -> Option<Poll> {
        env.storage().persistent().get(&DataKey::Poll(poll_id))
    }

    /// Get all poll IDs
    pub fn get_poll_ids(env: Env) -> Vec<u32> {
        Self::get_poll_ids_internal(&env)
    }

    /// Check if an address has voted on a poll
    pub fn has_voted(env: Env, voter: Address, poll_id: u32) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::HasVoted(poll_id, voter))
    }

    fn get_poll_ids_internal(env: &Env) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::PollIds)
            .unwrap_or(Vec::new(env))
    }

    fn next_id(env: &Env) -> u32 {
        let mut count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::PollCount)
            .unwrap_or(0);
        count += 1;
        env.storage().persistent().set(&DataKey::PollCount, &count);
        count
    }
}

mod test;
