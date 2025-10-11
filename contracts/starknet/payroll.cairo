%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.starknet.common.syscalls import get_caller_address
from starkware.cairo.common.math import assert_nn, assert_not_zero

// Storage for salary mappings
@storage_var
func salaries(address: felt) -> (amount: felt) {
}

// Storage for employer/owner
@storage_var
func owner() -> (address: felt) {
}

// Employer address storage
@storage_var
func employer(address: felt) -> (is_employer: felt) {
}

// Events
@event
func SalarySet(user: felt, salary: felt) {
}

@event
func EmployerAdded(employer: felt) {
}

// Constructor
@constructor
func constructor{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    owner_address: felt
) {
    owner.write(owner_address);
    return ();
}

// Modifiers helper
func assert_only_owner{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() {
    let (caller) = get_caller_address();
    let (owner_addr) = owner.read();
    assert caller = owner_addr;
    return ();
}

func assert_only_owner_or_employer{
    syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr
}() {
    let (caller) = get_caller_address();
    let (owner_addr) = owner.read();
    
    if (caller == owner_addr) {
        return ();
    }
    
    let (is_emp) = employer.read(caller);
    assert is_emp = 1;
    return ();
}

// Add employer
@external
func add_employer{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    employer_address: felt
) {
    assert_only_owner();
    assert_not_zero(employer_address);
    
    employer.write(employer_address, 1);
    EmployerAdded.emit(employer_address);
    return ();
}

// Set salary (only owner or employer can call)
@external
func set_salary{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    user_address: felt, salary_amount: felt
) {
    assert_only_owner_or_employer();
    assert_not_zero(user_address);
    assert_nn(salary_amount);
    
    salaries.write(user_address, salary_amount);
    SalarySet.emit(user_address, salary_amount);
    return ();
}

// Get salary (view function)
@view
func get_salary{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    user_address: felt
) -> (salary: felt) {
    let (salary) = salaries.read(user_address);
    return (salary=salary);
}

// Get owner
@view
func get_owner{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (
    owner_address: felt
) {
    let (owner_addr) = owner.read();
    return (owner_address=owner_addr);
}

// Check if address is employer
@view
func is_employer{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(
    address: felt
) -> (is_emp: felt) {
    let (is_emp) = employer.read(address);
    return (is_emp=is_emp);
}
