/**
 * GOOGLE APPS SCRIPT PRODUCTION CODE
 * ---------------------------------
 * Create these sheets exactly: 
 * "Students", "Teachers", "Rooms", "Books", "Borrow_Records", "Announcements", "Leaderboard", "Assignments"
 */

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    switch (action) {
      // READ Actions
      case 'getBooks': return output(getTableData(ss, "Books"));
      case 'getAnnouncements': return output(getTableData(ss, "Announcements"));
      case 'getLeaderboard': return output(getTableData(ss, "Leaderboard"));
      case 'getStudents': return output(getTableData(ss, "Students"));
      case 'getTeachers': return output(getTableData(ss, "Teachers"));
      case 'getRooms': return output(getTableData(ss, "Rooms"));
      case 'getAssignments': return output(getTableData(ss, "Assignments"));

      // WRITE Actions
      case 'addStudent': return addRow(ss, "Students", params, "STU");
      case 'addTeacher': return addRow(ss, "Teachers", params, "TEA");
      case 'addRoom': return addRow(ss, "Rooms", params, "RM");
      case 'addAnnouncement': return addRow(ss, "Announcements", params, "ANN");
      case 'sendAssignment': return addRow(ss, "Assignments", params, "ASGN");
      case 'addBorrowRecord': return addBorrowRecord(ss, params);
      
      default: return output({ error: 'Unknown action' });
    }
  } catch (err) {
    return output({ error: err.message });
  }
}

function getTableData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function addRow(ss, sheetName, params, prefix) {
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColName = headers[0];
  const id = prefix + Math.floor(1000 + Math.random() * 9000);
  
  const newRow = headers.map(h => {
    if (h === idColName) return id;
    if (h === 'created_at' || h === 'date') return new Date();
    return params[h] || "";
  });
  
  sheet.appendRow(newRow);
  return output({ success: true, id: id });
}

function addBorrowRecord(ss, params) {
  const sheet = ss.getSheetByName("Borrow_Records");
  const id = "REC" + Math.floor(1000 + Math.random() * 9000);
  sheet.appendRow([
    id,
    params.person_id,
    params.book_id,
    new Date(),
    params.due_date,
    false
  ]);
  
  // Update Book Inventory
  const bookSheet = ss.getSheetByName("Books");
  const bookData = bookSheet.getDataRange().getValues();
  for (let i = 1; i < bookData.length; i++) {
    if (bookData[i][0] == params.book_id) {
      const currentAvailable = bookData[i][4];
      bookSheet.getRange(i + 1, 5).setValue(currentAvailable - 1);
      break;
    }
  }
  
  return output({ success: true, record_id: id });
}

function output(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
