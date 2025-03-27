async function submitScore(teamId, judgeId, scores) {
    try {
        const scoreRef = ref(db, `scores/${teamId}/${judgeId}`);
        const scoreData = {
            ...scores,
            timestamp: serverTimestamp(),
            mostAdventurous: scores.mostAdventurous || false
        };
        await set(scoreRef, scoreData);
        return true;
    } catch (error) {
        console.error('Error submitting score:', error);
        throw error;
    }
}

async function getTeamScores(teamId) {
    try {
        const scoresRef = ref(db, `scores/${teamId}`);
        const snapshot = await get(scoresRef);
        if (snapshot.exists()) {
            const scores = [];
            snapshot.forEach((childSnapshot) => {
                const judgeId = childSnapshot.key;
                const scoreData = childSnapshot.val();
                scores.push({
                    judgeId,
                    ...scoreData,
                    mostAdventurous: scoreData.mostAdventurous || false
                });
            });
            return scores;
        }
        return [];
    } catch (error) {
        console.error('Error getting team scores:', error);
        throw error;
    }
} 