function escapeRegex(string) {
    if (typeof string !== 'string') return '';
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').substring(0, 100);
}

module.exports = escapeRegex;
