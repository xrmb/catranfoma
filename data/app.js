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


var SpeciesImport = {
  common_name:                'Common name',
  ct_code:                    'CT_code',
  classification:             'Class',
  species_id:                 'Species ID',
  kingdom:                    'Kingdom',
  phylum:                     'Phylum',
  order:                      'Order',
  family:                     'Family',
  genus:                      'Genus',
  species:                    'Species',
  authority:                  'Authority',
  infraspecific_rank:         'Infraspecific rank',
  infraspecific_name:         'Infraspecific name',
  infraspecific_authority:    'Infraspecific authority',
  stock_subpopulation:        'Stock/subpopulation',
  synonyms:                   'Synonyms',
  common_names_eng:           'Common names (Eng)',
  common_names_fre:           'Common names (Fre)',
  common_names_spa:           'Common names (Spa)',
  red_list_status:            'Red List status',
  red_list_criteria:          'Red List criteria',
  red_list_criteria_version:  'Red List criteria version',
  year_assessed:              'Year assessed',
  population_trend:           'Population trend',
  petitioned:                 'Petitioned',
};




var App =
{
  Appname: 'catranfoma',
  Version: 1.1,

  //--- member vars ------------------------------------------------------------
  _config:
  {
    target: '',
    winw: 800,
    winh: 600,
    winx: 80,
    winy: 60,
    winmax: 'no'
  },

  _locations: {},
  _species: [],
  _windows: [],
  _drives_cid: '-',


  //----------------------------------------------------------------------------
  init: function()
  {
    document.title = this.Appname[0].toUpperCase()+this.Appname.slice(1)+' v'+this.Version;
    try
    {
      this._fso = new ActiveXObject('Scripting.FileSystemObject');
      this._wsh = new ActiveXObject('WScript.Shell');
      this._sha = new ActiveXObject('Shell.Application');
    }
    catch(e)
    {
      alert('Scripting run-time library not registered on this computer. Cannot continue.');
    }

    this._env = this._wsh.Environment('Process');

    this._reel_entry = $$('#reel .entry')[0].cloneNode(true);
    this._drive_list_entry = $$('#drive_list .entry')[0].cloneNode(true);
    this._species_list_entry = $$('#species .entry')[0].cloneNode(true);
    this._app_species_list_entry = $$('#app .species_list .entry')[0].cloneNode(true);
    //this._target_details_entry = $$('#target_details .entry')[0].cloneNode(true);

    //--- click handlers ---
    window.addEventListener('resize',function(e) { e.preventDefault(); App.window_resize(); });
    $$('#app .menu .back')[0].addEventListener('click', function(e) { e.preventDefault(); App.window_close(); });
    $$('#app .menu .reload')[0].addEventListener('click', function(e) { e.preventDefault(); App.reel_update(); });
    $$('#app .menu .location_add')[0].addEventListener('click', function(e) { e.preventDefault(); App.location_add(); });
    $$('#app .menu .location')[0].addEventListener('change', function(e) { e.preventDefault(); App.location_assoc(); });
    $$('#app .menu .settings')[0].addEventListener('click', function(e) { e.preventDefault(); App.window_open('settings'); });
    $$('#app .species_menu .filter')[0].addEventListener('keyup', function(e) { e.preventDefault(); App.species_filter(e, this, $$('#app .species_list')[0]); });
    $$('#app .species_menu .manage')[0].addEventListener('click', function(e) { e.preventDefault(); App.species_open(); });

    $$('#species .menu .back')[0].addEventListener('click', function(e) { e.preventDefault(); App.window_close(); });
    $$('#species .menu .import')[0].addEventListener('click', function(e) { e.preventDefault(); App.species_import(); });

    this._drive_watch = setInterval(function() { App.drive_watch(); }, 10*1000);

    this.config_load();
    this.config_apply();

    this.location_load();
    this.species_load();

    //--- start with drives window ---
    this.drive_list_update();
    this.window_open('drives');
  },

  //----------------------------------------------------------------------------
  exit: function()
  {
    clearInterval(this._drive_watch);
    this._drive_watch = 0;

    this.config_save();
    this.location_save();
  },

  //----------------------------------------------------------------------------
  wmic: function(what)
  {
    var out = this._env('TEMP')+'\\'+this.Appname+'.wmic';

    if(this._fso.FileExists(out) && !this._fso.DeleteFile(out)) return [];

    var cmd = 'wmic /output:'+out+' '+what+' list /format:csv';
    var r = this._wsh.Run(cmd, 0, true);

    if(!this._fso.FileExists(out)) return [];

    var ret = [];
    var f = this._fso.OpenTextFile(out, 1, false, -1); // 1..read, -1...unicode
    if(f)
    {
      var c = f.ReadAll();
      f.Close();
      this._fso.DeleteFile(out, true);

      c = c.replace(/^\s+|\s+$/g, '').split(/[\r\n]+/);
      h = c.shift().split(/,/);

      for(var i = 0; i < c.length; i++)
      {
        var c0 = c[i].split(/,/);
        var o = {};
        for(var j = 0; j < h.length; j++)
        {
          o[h[j]] = c0[j];
        }
        ret.push(o);
      }
    }

    return ret;
  },

  //----------------------------------------------------------------------------
  config_load: function()
  {
    if(!this._fso.FileExists('config/app.json')) return;

    var fh = this._fso.OpenTextFile('config/app.json', 1);  // 1 = forReading
    if(!fh) return;

    var json = fh.ReadAll();
    fh.Close();

    var conf;
    try
    {
      conf = JSON.parse(json);
    }
    catch(e)
    {
      alert('Loading config failed ('+e.message+')');
      return;
    }

    for(var key in this._config)
    {
      this._config[key] = conf[key] || this._config[key];
    }
  },

  //----------------------------------------------------------------------------
  config_save: function()
  {
    if(!this._fso.FolderExists('config'))
    {
      if(!this._fso.CreateFolder('config')) return;
    }

    this._config.winmax = (window.outerWidth > screen.availWidth && window.outerHeight > screen.availHeight) ? 'yes' : 'no';
    if(this._config.winmax == 'no')
    {
      this._config.winx = window.screenX;
      this._config.winy = window.screenY;
      this._config.winw = window.outerWidth;
      this._config.winh = window.outerHeight;
    }

    var json = JSON.stringify(this._config, null, 2/*indent*/);

    var fh = this._fso.CreateTextFile('config/app.json', true/*overwrite*/);
    if(!fh) return;
    fh.WriteLine(json);
    fh.Close();
  },

  //----------------------------------------------------------------------------
  config_apply: function()
  {
    document.settings.target.value = this._config.target || '';
    this.location_update();

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
  target_browse: function()
  {
    var f = this._sha.BrowseForFolder(0, 'Browse for target folder', 0, 0x11); // 0x11 ssfDRIVES
    if(!f) return;

    document.settings.target.value = f.Items().Item().Path;
    this.location_update();
    this.location_detect();
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
  source_recurse: function(fh, l)
  {
    var itf = new Enumerator(fh.SubFolders);
    for(; !itf.atEnd(); itf.moveNext())
    {
      var sfh = this._fso.GetFolder(itf.item().Path);
      if(!sfh) continue;
      l = this.source_recurse(sfh, l);
    }

    itf = new Enumerator(fh.Files);
    for(; !itf.atEnd(); itf.moveNext())
    {
      if(!itf.item().Name.match(/\.(jpg)$/i)) continue;
      l.push(itf.item());
    }
    return l;
  },

  //----------------------------------------------------------------------------
  source_read: function()
  {
    var fh = this._fso.GetFolder(document.app.source.value);
    if(!fh) { return null; }

    return this.source_recurse(fh, []).sort(function(a, b) { return a.Path.localeCompare(b.Path); });
  },

  //----------------------------------------------------------------------------
  reel_update: function()
  {
    if(!this._fso.FolderExists(document.app.source.value)) return this.reel_message('Source folder does not exists.');

    var files = this.source_read();
    if(!files) return this.reel_message('Error reading source folder.');

    var reel = $('reel');
    reel.innerHTML = '';

    var count = 0;
    for(var i = 0; i < files.length && count < 10; i++)
    {
      var f = files[i];
      if(!f.Name.match(/\.(jpg)$/i)) continue;
      count++;

      var entry = this._reel_entry.cloneNode(true);
      entry.title = f.Path;
      $$('.img', entry)[0].src = f.Path;
      $$('.check', entry)[0].value = f.Path;
      $$('.label', entry)[0].firstChild.data = f.Name;
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
  window_open: function(win)
  {
    this._windows.push(win);
    document.drives.style.display = (win == 'drives' ? '' : 'none');
    document.app.style.display = (win == 'app' ? '' : 'none');
    document.settings.style.display = (win == 'settings' ? '' : 'none');
    document.species.style.display = (win == 'species' ? '' : 'none');
  },

  //----------------------------------------------------------------------------
  window_close: function()
  {
    this._windows.pop();
    this.window_open(this._windows.pop());
  },

  //----------------------------------------------------------------------------
  window_resize: function()
  {
    var l = $$('.layout');
    for(var i = 0; i < l.length; i++)
    {
      l[i].style.height = (window.innerHeight-0)+'px';
    }
  },

  //----------------------------------------------------------------------------
  settings_close: function()
  {
    this.window_close();
    this.config_apply();
  },

  //----------------------------------------------------------------------------
  location_add: function()
  {
    var n = prompt('New location:', '');
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

    this.location_update(n);

    return null;
  },

  //----------------------------------------------------------------------------
  target_list_entry_click: function(el)
  {
    var s = $$('#target_list .selected');
    if(s.length) s[0].toggleClass('selected');

    el.parentNode.toggleClass('selected');
  },

  //----------------------------------------------------------------------------
  drive_list_update: function()
  {
    // trying to find out what is an sdcard/usb drive
    // might have to make my own bin
    //var dd = this.wmic('diskdrive');

    var cid = '';
    var itd = new Enumerator(this._fso.Drives);
    var drives = [];
    for(; !itd.atEnd(); itd.moveNext())
    {
      var d = itd.item();
      if(d.DriveType != 1) continue;
      if(d.DriveLetter == '') continue;
      if(!d.IsReady) continue;
      if(!this._fso.FolderExists(d.RootFolder+'DCIM')) continue;

      cid += d.SerialNumber+'|'+d.VolumeName+'|';
      drives.push(d);
    }
    if(this._drives_cid == cid) return;
    this._drives_cid = cid;


    var list = $('drive_list');
    list.innerHTML = '';

    for(var i = 0; i < drives.length; i++)
    {
      var d = drives[i];

      var entry = this._drive_list_entry.cloneNode(true);
      //entry.title = d.Path;
      var img = 'data/128/download156.png';
      if(d.VolumeName.match(/usb/i)) img = 'data/128/usb50.png';
      if(d.VolumeName.match(/sd/i)) img = 'data/128/memory9.png';

      $$('.img', entry)[0].src = img;
      $$('.label', entry)[0].firstChild.data = d.VolumeName + ' (' + d.DriveLetter + ':)';
      $$('.check', entry)[0].value = d.RootFolder+'DCIM';
      //$$('.check', entry)[0].disabled = !d.IsReady;
      list.appendChild(entry);
    }

    var entry = this._drive_list_entry.cloneNode(true);
    $$('.img', entry)[0].src = 'data/128/folder230.png';
    $$('.label', entry)[0].innerHTML = 'browse...';
    $$('.check', entry)[0].value = '?';
    list.appendChild(entry);


    var e = $$('#drive_list .check');
    for(var i = 0; i < e.length; i++)
    {
      e[i].addEventListener('click', function() { App.drive_list_entry_click(this); });
    }
  },

  //----------------------------------------------------------------------------
  drive_list_entry_click: function(el)
  {
    el.checked = false;
    if(el.value == '?')
    {
      var f = this._sha.BrowseForFolder(0, 'Browse for target folder', 0, 0x11); // 0x11 ssfDRIVES
      if(!f) return;

      document.app.source.value = f.Items().Item().Path;
    }
    else
    {
      document.app.source.value = el.value;
    }

    this.location_detect();
    this.reel_update();
    this.species_list_update();

    this.window_open('app');
  },

  //----------------------------------------------------------------------------
  drive_watch: function()
  {
    if(this._windows[this._windows.length-1] == 'drives')
    {
      this.drive_list_update();
    }
    else
    {
      // check if source is still there
    }
  },

  //----------------------------------------------------------------------------
  location_update: function(s)
  {
    s = s || document.app.location.value;
    var o = document.app.location.options;
    o.length = 0;

    if(!this._config.target || !this._fso.FolderExists(this._config.target))
    {
      o[o.length] = new Option('invalid target');
      return;
    }

    var fh = this._fso.GetFolder(this._config.target);
    if(!fh)
    {
      o[o.length] = new Option('error reading target');
      return;
    }

    var itf = new Enumerator(fh.SubFolders);
    if(!itf.atEnd())
    {
      o[o.length] = new Option('');
    }
    for(; !itf.atEnd(); itf.moveNext())
    {
      var f = itf.item();
      o[o.length] = new Option(f.Name, f.Path, false, f.Path == s || f.Name == s);
      o[o.length-1].title = f.Path;
    }

    if(!o.length)
    {
      o[o.length] = new Option('no locations found');
    }
  },

  //----------------------------------------------------------------------------
  location_detect: function()
  {
    var dh = this._fso.GetDrive(this._fso.GetDriveName(document.app.source.value));
    if(dh.DriveType == 1/*removable*/)
    {
      document.app.location.value = this._locations[ dh.SerialNumber ];
    }
    else
    {
      document.app.location.value = this._locations[ document.app.source.value ];
    }
  },

  //----------------------------------------------------------------------------
  location_assoc: function()
  {
    var dh = this._fso.GetDrive(this._fso.GetDriveName(document.app.source.value));
    if(dh.DriveType == 1/*removable*/)
    {
      this._locations[ dh.SerialNumber ] = document.app.location.value;
    }
    else
    {
      this._locations[ document.app.source.value ] = document.app.location.value;
    }
  },


  //----------------------------------------------------------------------------
  location_load: function()
  {
    if(!this._fso.FileExists('config/locations.json')) return;

    var fh = this._fso.OpenTextFile('config/locations.json', 1);  // 1 = forReading
    if(!fh) return;

    var json = fh.ReadAll();
    fh.Close();

    var data;
    try
    {
      data = JSON.parse(json);
    }
    catch(e)
    {
      alert('Loading locations failed ('+e.message+')');
      return;
    }
    this._locations = data;
  },

  //----------------------------------------------------------------------------
  location_save: function()
  {
    var json = JSON.stringify(this._locations, null, 2/*indent*/);

    var fh = this._fso.CreateTextFile('config/locations.json', true/*overwrite*/);
    if(!fh) return;
    fh.WriteLine(json);
    fh.Close();
  },


  //----------------------------------------------------------------------------
  species_load: function()
  {
    if(!this._fso.FileExists('config/species.json')) return;

    var fh = this._fso.OpenTextFile('config/species.json', 1);  // 1 = forReading
    if(!fh) return;

    var json = fh.ReadAll();
    fh.Close();

    var data;
    try
    {
      data = JSON.parse(json);
    }
    catch(e)
    {
      alert('Loading species failed ('+e.message+')');
      return;
    }
    this._species = data;
  },


  //----------------------------------------------------------------------------
  species_save: function()
  {
    var json = JSON.stringify(this._species, null, 2/*indent*/);

    var fh = this._fso.CreateTextFile('config/species.json', true/*overwrite*/);
    if(!fh) return;
    fh.WriteLine(json);
    fh.Close();
  },


  //----------------------------------------------------------------------------
  species_open: function()
  {
    this.window_open('species');

    var ch = $$('#species .list')[0].parentElement.offsetHeight;
    var hh = $$('#species .list thead')[0].offsetHeight;
    var b = $$('#species .list tbody')[0];
    //b.style.height = (ch-hh)+'px';

    this.species_list_update();
    document.species.filter.focus();
  },


  //----------------------------------------------------------------------------
  species_list_update: function()
  {
    var list = $$('#species .list tbody')[0];
    while(list.firstChild)
    {
      list.removeChild(list.firstChild);
    }

    for(var i = 0; i < this._species.length; i++)
    {
      var entry = this._species_list_entry.cloneNode(true);
      entry.className = 'species-'+i;

      for(var key in SpeciesImport)
      {
        var el = $$('.'+key, entry)[0];
        if(!el) continue;
        el.firstChild.data = this._species[i][key];
      }

      list.appendChild(entry);
    }


    list = $$('#app .species_list tbody')[0];
    while(list.firstChild)
    {
      list.removeChild(list.firstChild);
    }

    for(var i = 0; i < this._species.length; i++)
    {
      var entry = this._app_species_list_entry.cloneNode(true);
      entry.className = 'species-'+i;
      $$('.check', entry)[0].value = i;

      for(var key in SpeciesImport)
      {
        var el = $$('.'+key, entry)[0];
        if(!el) continue;
        el.firstChild.data = this._species[i][key];
      }

      list.appendChild(entry);
    }
  },


  //----------------------------------------------------------------------------
  species_import: function()
  {
    var lines = window.clipboardData.getData('Text').replace(/^\s*|\s*$/g, '').split(/[\n\r]+/);
    if(lines.length < 2) return;

    //--- reverse lookup ---
    var sir = {};
    for(var key in SpeciesImport)
    {
      sir[SpeciesImport[key].toLowerCase()] = key;
    }


    //--- parse header ---
    var ok = {}
    var h = lines.shift().toLowerCase().split(/ *\t */);
    var h2f = [];
    for(var i = 0; i < h.length; i++)
    {
      if(!sir[h[i]]) continue;
      h2f[i] = sir[h[i]];
      ok[sir[h[i]]] = i;
    }


    //--- check if we got all columns we need ---
    for(var key in SpeciesImport)
    {
      if(ok[key] === null)
      {
        alert('Column "'+SpeciesImport[key]+'" not found.');
        return;
      }
    }

    var ss = [];
    for(var i = 0; i < lines.length; i++)
    {
      var row = lines[i].split(/ *\t */);
      var s = {};
      for(var j = 0; j < row.length; j++)
      {
        if(!h2f[j]) continue;
        s[h2f[j]] = row[j];
      }
      ss.push(s);
    }

    alert(ss.length+' species imported.');

    this._species = ss;
    this.species_save();
    this.species_list_update();
  },

  //----------------------------------------------------------------------------
  species_filter: function(e, input, list)
  {
    for(var i = 0; i < this._species.length; i++)
    {
      var match = false;
      for(var key in this._species[i])
      {
        if(input.value == '' || this._species[i][key].toLowerCase().indexOf(input.value.toLowerCase()) != -1)
        {
          match = true;
          break;
        }
      }

      $$('.species-'+i+' tr', list)[0].style.display = match ? '' : 'none';
    }
  }
}
