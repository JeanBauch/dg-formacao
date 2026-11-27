// Where the holder's signed-in browser state is kept between the setup that
// signs in and the tests that reuse it. The folder is not committed: the state
// holds a live session of the E2E's database.
export const holderState = "e2e/.auth/holder.json";
