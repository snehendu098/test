#![cfg(test)]
use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{vec, Env, String};

#[test]
fn test_create_poll() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let options = vec![
        &env,
        String::from_str(&env, "Yes"),
        String::from_str(&env, "No"),
    ];
    let poll_id = client.create_poll(&String::from_str(&env, "Should we deploy?"), &options);

    let poll = client.get_poll(&poll_id).unwrap();
    assert_eq!(poll.question, String::from_str(&env, "Should we deploy?"));
    assert_eq!(poll.options.len(), 2);
    assert_eq!(poll.options.get(0).unwrap(), String::from_str(&env, "Yes"));
    assert_eq!(poll.votes.get(0).unwrap(), 0i128);
}

#[test]
fn test_vote() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let options = vec![
        &env,
        String::from_str(&env, "Rust"),
        String::from_str(&env, "Go"),
    ];
    let poll_id = client.create_poll(&String::from_str(&env, "Best language?"), &options);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    client.vote(&user1, &poll_id, &0);
    client.vote(&user2, &poll_id, &1);

    let poll = client.get_poll(&poll_id).unwrap();
    assert_eq!(poll.votes.get(0).unwrap(), 1i128);
    assert_eq!(poll.votes.get(1).unwrap(), 1i128);

    assert!(client.has_voted(&user1, &poll_id));
    assert!(client.has_voted(&user2, &poll_id));
}

#[test]
#[should_panic(expected = "Already voted")]
fn test_cannot_vote_twice() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let options = vec![
        &env,
        String::from_str(&env, "A"),
        String::from_str(&env, "B"),
    ];
    let poll_id = client.create_poll(&String::from_str(&env, "Test poll"), &options);

    let user = Address::generate(&env);
    client.vote(&user, &poll_id, &0);
    client.vote(&user, &poll_id, &1); // Should panic
}

#[test]
fn test_add_option() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let options = vec![&env, String::from_str(&env, "Pizza")];
    let poll_id = client.create_poll(&String::from_str(&env, "Favorite food?"), &options);

    client.add_option(&poll_id, &String::from_str(&env, "Burger"));

    let poll = client.get_poll(&poll_id).unwrap();
    assert_eq!(poll.options.len(), 2);
    assert_eq!(poll.votes.len(), 2);
    assert_eq!(poll.votes.get(1).unwrap(), 0i128);
}

#[test]
fn test_get_poll_ids() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let options = vec![&env, String::from_str(&env, "A")];
    let poll_id1 = client.create_poll(&String::from_str(&env, "Poll 1"), &options);
    let poll_id2 = client.create_poll(&String::from_str(&env, "Poll 2"), &options);

    let ids = client.get_poll_ids();
    assert_eq!(ids.len(), 2);
    assert!(ids.contains(&poll_id1));
    assert!(ids.contains(&poll_id2));
}
