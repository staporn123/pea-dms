function doGet(e) {
  try {
    e = e || { parameter: {} };

    const params = e.parameter || {};
    const action = params.action || "ping";
    const callback = params.callback || "";

    let result;

    if (action === "ping") {
      result = {
        message: "PEA DMS API is running",
        version: CONFIG.VERSION
      };

    } else if (action === "init") {
      result = appInit();

    } else if (action === "createDocument") {
      const data = JSON.parse(params.data || "{}");
      result = createDocument(data);

    } else if (action === "updateDocument") {
      const data = JSON.parse(params.data || "{}");
      result = updateDocument(data);

    } else if (action === "cancelDocument") {
      const data = JSON.parse(params.data || "{}");
      result = cancelDocument(data.id);

    } else {
      throw new Error("ไม่พบ action: " + action);
    }

    return output_(result, callback);

  } catch (err) {
    return errorOutput_(err, e);
  }
}

function doPost(e) {
  return doGet(e || { parameter: {} });
}

function output_(result, callback) {
  const output = {
    success: true,
    result: result
  };

  const text = callback
    ? callback + "(" + JSON.stringify(output) + ")"
    : JSON.stringify(output);

  return ContentService
    .createTextOutput(text)
    .setMimeType(
      callback
        ? ContentService.MimeType.JAVASCRIPT
        : ContentService.MimeType.JSON
    );
}

function errorOutput_(err, e) {
  const callback =
    e && e.parameter && e.parameter.callback
      ? e.parameter.callback
      : "";

  const output = {
    success: false,
    message: err.message
  };

  const text = callback
    ? callback + "(" + JSON.stringify(output) + ")"
    : JSON.stringify(output);

  return ContentService
    .createTextOutput(text)
    .setMimeType(
      callback
        ? ContentService.MimeType.JAVASCRIPT
        : ContentService.MimeType.JSON
    );
}
