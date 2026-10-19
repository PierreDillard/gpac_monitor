function buildJournalPointer(journalTsUs, journalTypes) {
    if (journalTsUs.length === 0) return undefined;
    const errorCount = journalTypes.filter((type) => type === 1).length;
    const warningCount = journalTypes.filter((type) => type === 2).length;
    return {
        file: 'journal_index.json',
        format: 'columnar-delta-v1',
        eventCount: journalTsUs.length,
        errorCount,
        warningCount,
    };
}

function serializeJournalIndex(journalTsUs, journalTypes) {
    const baseTsUs = journalTsUs[0];
    return {
        baseTsUs,
        tsDeltaUs: journalTsUs.map((tsUs) => tsUs - baseTsUs),
        types: journalTypes,
    };
}

export { buildJournalPointer, serializeJournalIndex };
