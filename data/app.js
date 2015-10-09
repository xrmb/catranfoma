function $(id)
{
  return document.getElementById(id);
}

function $$(selector, el)
{
  return (el || document).querySelectorAll(selector);
}


Element.prototype.toggleClass = function(c)
{
  if(this.className.indexOf(c) == -1)
  {
    this.className += ' '+c;
  }
  else
  {
    this.className = this.className.replace(new RegExp('\\b'+c+'\\b'), '');
  }
}


var App =
{
  _config:
  {
    source: '',
    target: '',
    winw: 800,
    winh: 600,
    winx: 80,
    winy: 60,
    winmax: 'no'
  },

  //----------------------------------------------------------------------------
  init: function()
  {
    try
    {
      this._fso = new ActiveXObject("Scripting.FileSystemObject");
      this._wsh = new ActiveXObject("WScript.Shell");
      this._sha = new ActiveXObject("Shell.Application");
    }
    catch(e)
    {
      alert("Scripting run-time library not registered on this computer. Cannot continue.");
    }

    this._reel_entry = $$('#reel .entry')[0].cloneNode(true);
    this._target_list_entry = $$('#target_list .entry')[0].cloneNode(true);
    this._target_details_entry = $$('#target_details .entry')[0].cloneNode(true);

    this.config_load();
    this.config_apply();
    this.reel_update();
    this.target_update();
  },

  //----------------------------------------------------------------------------
  exit: function()
  {
    this.config_save();
  },

  //----------------------------------------------------------------------------
  config_load: function()
  {
    if(!this._fso.FileExists("app.config")) return;

    var fh = this._fso.OpenTextFile("app.config", 1);  // 1 = forReading
    if(!fh) return;

    while(!fh.AtEndOfStream)
    {
      var l = fh.ReadLine().split(/\t/, 2);
      if(l.length != 2) continue;
      this._config[l[0]] = l[1];
    }
    fh.Close();
  },

  //----------------------------------------------------------------------------
  config_save: function()
  {
    var fh = this._fso.CreateTextFile("app.config", true/*overwrite*/);
    if(!fh) return;

    this._config.winmax = (window.outerWidth > screen.availWidth && window.outerHeight > screen.availHeight) ? 'yes' : 'no';
    if(this._config.winmax == 'no')
    {
      this._config.winx = window.screenX;
      this._config.winy = window.screenY;
      this._config.winw = window.outerWidth;
      this._config.winh = window.outerHeight;
    }

    for(var k in this._config)
    {
      fh.WriteLine(k+'\t'+this._config[k]);
    }
    fh.Close();
  },

  //----------------------------------------------------------------------------
  config_apply: function()
  {
    document.app.source.value = this._config.source || '';
    document.settings.target.value = this._config.target || '';

    if(this._config.winmax == 'yes')
    {
      //--- todo: dont know how to maximize window
      //---       could try writing hta:app dynamically
    }
    else
    {
      window.moveTo(this._config.winx, this._config.winy);
      window.resizeTo(this._config.winw, this._config.winh);
    }
  },

  //----------------------------------------------------------------------------
  source_browse: function()
  {
    var f = this._sha.BrowseForFolder(0, 'Browse for source folder', 0, 0x11); // 0x11 ssfDRIVES
    if(!f) return;

    this._config.source = f.Items().Item().Path;
    this.config_apply();
    this.reel_update();
  },

  //----------------------------------------------------------------------------
  target_browse: function()
  {
    var f = this._sha.BrowseForFolder(0, 'Browse for target folder', 0, 0x11); // 0x11 ssfDRIVES
    if(!f) return;

    document.settings.target.value = f.Items().Item().Path;
    this.target_update();
  },

  //----------------------------------------------------------------------------
  reel_message: function(message)
  {
    var reel = $('reel');
    reel.innerHTML = '';

    var msg = document.createElement('div');
    msg.className = 'message';
    msg.innerHTML = message;

    reel.appendChild(msg);
  },

  //----------------------------------------------------------------------------
  reel_entry_click: function(el)
  {
    el.parentNode.toggleClass('selected');
  },

  //----------------------------------------------------------------------------
  reel_update: function()
  {
    var reel = $('reel');

    if(!this._config.source) return this.reel_message('Please set a source.');
    if(!this._config.target) return this.reel_message('Please set a target.');

    if(!this._fso.FolderExists(this._config.source)) return this.reel_message('Source folder does not exists.');
    if(!this._fso.FolderExists(this._config.target)) return this.reel_message('Target folder does not exists.');

    var fh = this._fso.GetFolder(this._config.source);
    if(!fh) return this.reel_message('Error reading source folder.');

    reel.innerHTML = '';
    var itf = new Enumerator(fh.files);
    var count = 0;
    for (; !itf.atEnd() && count < 10; itf.moveNext())
    {
      if(!itf.item().Name.match(/\.(jpg)$/i)) continue;
      count++;

      var entry = this._reel_entry.cloneNode(true);
      entry.title = itf.item().Path;
      $$('.img', entry)[0].src = itf.item();
      $$('.check', entry)[0].value = itf.item().Path;
      $$('.filename', entry)[0].innerHTML = itf.item().Name;
      reel.appendChild(entry);
    }

    if(count == 0)
    {
      return reel_message('No images found.');
    }


    var e = $$('#reel .check');
    for(var i = 0; i < e.length; i++)
    {
      e[i].addEventListener('click', function() { App.reel_entry_click(this); });
    }

    return null;
  },

  //----------------------------------------------------------------------------
  settings_save: function()
  {
    this._config.target = document.settings.target.value;

    this.settings_close();
  },

  //----------------------------------------------------------------------------
  settings_open: function()
  {
    document.app.style.display = 'none';
    document.settings.style.display = '';
  },

  //----------------------------------------------------------------------------
  settings_close: function()
  {
    document.app.style.display = '';
    document.settings.style.display = 'none';

    this.config_apply();
  },

  //----------------------------------------------------------------------------
  target_new: function()
  {
    var n = prompt('New target: "Species @number"', '');
    if(!n) return null;

    var m = n.match(/[^\w]/i);
    if(m && m.length)
    {
      return alert('Invalid name (character: '+m[0]+')')
    }

    try
    {
      var fh = this._fso.CreateFolder(this._config.target+'\\'+n);
      if(!fh) { return alert('Create failed (1).'); }
    }
    catch(e)
    {
      return alert('Create failed ('+e.message+').');
    }

    if(!this._fso.FolderExists(this._config.target+'\\'+n))
    {
      return alert('Create failed (2).');
    }

    this.target_update();

    return null;
  },

  //----------------------------------------------------------------------------
  target_message: function(message)
  {
    var list = $('target_list');
    list.innerHTML = '';

    var msg = document.createElement('div');
    msg.className = 'message';
    msg.innerHTML = message;

    list.appendChild(msg);
  },

  //----------------------------------------------------------------------------
  target_update: function()
  {
    var list = $('target_list');
    list.innerHTML = '';

    if(!this._config.target) return this.target_message('Please set a target.');

    var fh = this._fso.GetFolder(this._config.target);
    if(!fh) return this.target_message('Error reading target.');

    if(fh.SubFolders.length == 0) return this.target_message('No targets setup.');

    var itf = new Enumerator(fh.SubFolders);
    for (; !itf.atEnd(); itf.moveNext())
    {
      var entry = this._target_list_entry.cloneNode(true);
      entry.title = itf.item().Path;
      $$('.label', entry)[0].innerHTML = itf.item().Name;
      $$('.check', entry)[0].value = itf.item().Path;
      list.appendChild(entry);
    }

    var e = $$('#target_list .check');
    for(var i = 0; i < e.length; i++)
    {
      e[i].addEventListener('click', function() { App.target_list_entry_click(this); });
    }

    return null;
  },

  //----------------------------------------------------------------------------
  target_list_entry_click: function(el)
  {
    var s = $$('#target_list .selected');
    if(s.length) s[0].toggleClass('selected');

    el.parentNode.toggleClass('selected');
  }
}
