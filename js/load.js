loadJSON = function (url, callback, progress) {
  var xhr = new XMLHttpRequest();
  var length = 0;

  xhr.onreadystatechange = function () {
    if (xhr.readyState === xhr.DONE) {
      if (xhr.status === 200 || xhr.status === 0) {
        if (xhr.responseText) {
          var json = JSON.parse(xhr.responseText);
          callback(json);
        } else {
          console.error('cannot retrieve json from ' + url);
        }
      } else {
        console.error('cannot retrieve json from ' + url + '.  status: ' + xhr.status);
      }
    } else if (xhr.readyState === xhr.LOADING) {
      if (progress) {
        if (length === 0) {
          length = xhr.getResponseHeader('Content-Length');
        }
        progress({total: length, loaded: xhr.responseText.length});
      }
    } else if (xhr.readyState === xhr.HEADERS_RECEIVED) {
      if (progress !== undefined) {
        length = xhr.getResponseHeader('Content-Length');
      }
    }
  };

  xhr.open('GET', url, true);
  xhr.send(null);
};
