const key = "itsaboardgame.local.session";
export function saveLocalSession(state) {
    localStorage.setItem(key, JSON.stringify(state));
}
export function loadLocalSession() {
    const raw = localStorage.getItem(key);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
