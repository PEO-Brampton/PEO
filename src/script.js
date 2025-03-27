// Update the form submission handler
document.getElementById('judging-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const teamId = document.getElementById('team-select').value;
    const judgeId = getCurrentJudgeId(); // You'll need to implement this
    
    const scores = {
        criteria1: parseInt(document.getElementById('criteria1').value),
        criteria2: parseInt(document.getElementById('criteria2').value),
        criteria3: parseInt(document.getElementById('criteria3').value),
        criteria4: parseInt(document.getElementById('criteria4').value),
        criteria5: parseInt(document.getElementById('criteria5').value),
        comments: document.getElementById('judge-comments').value,
        mostAdventurous: document.getElementById('most-adventurous').checked
    };

    try {
        await submitScore(teamId, judgeId, scores);
        alert('Score submitted successfully!');
        e.target.reset();
    } catch (error) {
        alert('Error submitting score: ' + error.message);
    }
});

// Update the leaderboard display function
function updateLeaderboardRow(team, scores) {
    const row = document.createElement('tr');
    const totalScore = scores.reduce((sum, score) => sum + score.total, 0);
    const mostAdventurousCount = scores.filter(score => score.mostAdventurous).length;
    
    row.innerHTML = `
        <td>${team.teamNumber}</td>
        <td>${team.teamName}</td>
        <td>${team.category}</td>
        <td>${getTeamStatus(team)}</td>
        <td>${totalScore}</td>
        <td>${mostAdventurousCount > 0 ? '⭐' : ''}</td>
    `;
    
    return row;
} 