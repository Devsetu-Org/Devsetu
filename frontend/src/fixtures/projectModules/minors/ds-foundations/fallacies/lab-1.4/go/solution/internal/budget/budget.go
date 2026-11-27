package budget

// DefaultAttempts is the fallback when class is unknown.
const DefaultAttempts = 5

// AttemptBudget returns per-class RPC attempt budgets.
func AttemptBudget(class string) int {
	switch class {
	case "rider":
		return 5
	case "driver":
		return 4
	case "server":
		return 2
	default:
		return DefaultAttempts
	}
}
