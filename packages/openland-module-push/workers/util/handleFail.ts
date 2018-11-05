interface BasePushToken {
    enabled: boolean;
    failures?: number| null;
    failedFirstAt?: number| null;
    failedLastAt?: number| null;
    disabledAt?: number| null;
}

export async function handleFail(token: BasePushToken) {
    if (!token.failures) {
        token.failures = 1;
        token.failedFirstAt = Date.now();
    } else {
        token.failures++;
    }
    token.failedLastAt = Date.now();

    // Disable token after 3 days
    if ((token.failedLastAt - token.failedFirstAt!) > 1000 * 60 * 60 * 24 * 3) {
        token.enabled = false;
        token.disabledAt = Date.now();
    }
}