const fs = require('fs');

// Read the HTML file
const html = fs.readFileSync('temp.html', 'utf-8');

// Split by roundWidgetContainer divs
const containerRegex = /<div role="button" class="roundWidgetContainer[^"]*">/g;
const parts = html.split(containerRegex);

const rounds = [];

// Process each round container
for (let i = 1; i < parts.length; i++) {
  const section = parts[i];

  // Extract course name
  const courseMatch = section.match(/<div class="courseName" title="([^"]+)">/);

  // Extract date
  const dateMatch = section.match(/<div class="date">([^<]+)<\/div>/);

  // Extract total score (looking for the "Total" row specifically)
  const totalMatches = section.match(/<div class="inOutTotalsTitle">Total<\/div><div class="inOutTotalsValue">(\d+)<\/div>/);

  if (courseMatch && dateMatch && totalMatches) {
    const courseName = courseMatch[1];
    const dateStr = dateMatch[1].trim();
    const total = totalMatches[1];

    // Extract just the date part (before "at HH:MM")
    const datePart = dateStr.split(' at ')[0];

    rounds.push({
      date: datePart,
      course: courseName,
      total: total
    });
  }
}

// Display results
console.log('| Date | Course | Total Score |');
console.log('|------|--------|-------------|');

rounds.forEach(round => {
  console.log(`| ${round.date} | ${round.course} | ${round.total} |`);
});

console.log(`\nTotal rounds found: ${rounds.length}`);
