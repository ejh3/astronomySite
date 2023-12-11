function parseStarData(filePath) {
  const dataMap = {};
  const fs = require('fs');

  // Read the CSV file line by line
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  // Create the data structure
  for (const line of lines) {
    // Skip empty lines and the header row
    if (!line || line.startsWith('B-V;Lum;GrpName')) continue;
    const [bV, lum, grpName] = line.split(';');
    const bVNum = parseFloat(bV);
    const lumNum = parseFloat(lum);

    // Initialize the array if it doesn't exist
    if (!dataMap[grpName]) {
      dataMap[grpName] = [];
    }

    // Add the B-V and Lum pair to the array
    dataMap[grpName].push({ bV: bVNum, lum: lumNum });
  }

  // Build the output string
  let outputString = "const starData = {\n";

  // Iterate over each GrpName in the dataMap
  for (const grpName in dataMap) {
    outputString += `  "${grpName}": [\n`;

    // Iterate over each data point for the current group
    for (const dataPoint of dataMap[grpName]) {
      outputString += `    { "bV": ${dataPoint.bV}, "lum": ${dataPoint.lum} },\n`;
    }

    // Close the group
    outputString = outputString.substring(0, outputString.length - 2) + "\n  ],\n";
  }

  // Close the data structure and print the final string
  outputString = outputString.substring(0, outputString.length - 2) + "\n}";
  console.log(outputString);
}