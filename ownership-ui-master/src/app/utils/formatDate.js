export default function formatDate(apiDate) {
    const date = new Date(apiDate);
    const options = { day: '2-digit', month: 'long', year: 'numeric' };
    return new Intl.DateTimeFormat('en-GB', options).format(date);
}

export function formatDateBC(apiDate) {
    if (apiDate == null || apiDate === '') return '';
    const dateString = String(apiDate).split(' ')[0];
    const formattedDate = new Date(dateString);

    if (isNaN(formattedDate.getTime())) {
        return 'Invalid Date';
    }

    const options = { day: '2-digit', month: 'long', year: 'numeric' };
    return new Intl.DateTimeFormat('en-GB', options).format(formattedDate);
}

/**
 * Parse date from API/blockchain (handles Go time.String() e.g. "2022-12-13 05:32:03.273 +0000 UTC").
 * Returns a Date or null if invalid.
 */
function parseDateSafe(value) {
    if (value == null || value === '') return null;
    const s = String(value).trim();
    // Try native parse first (ISO, etc.)
    let d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    // Go-style: "YYYY-MM-DD HH:MM:SS.xxx +0000 UTC" – use first 19 chars as "YYYY-MM-DD HH:MM:SS"
    const dateTimePart = s.slice(0, 19);
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateTimePart)) {
        d = new Date(dateTimePart.replace(' ', 'T'));
        if (!isNaN(d.getTime())) return d;
    }
    // Date only: "YYYY-MM-DD"
    const dateOnly = s.split(' ')[0];
    if (dateOnly && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
        d = new Date(dateOnly);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

/** Date and time (e.g. for History Assigned Date / Reassign Date). */
export function formatDateBCWithTime(apiDate) {
    const formattedDate = parseDateSafe(apiDate);
    if (formattedDate == null) return '';

    const options = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    return new Intl.DateTimeFormat('en-GB', options).format(formattedDate);
}
