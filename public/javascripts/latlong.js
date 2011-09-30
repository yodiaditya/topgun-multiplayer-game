decpl = 4;

function computeCD(getLat1, getLon1, getLat2, getLon2) {
  var signlat1, signlat2, signlon1, signlon2, dc;
  var lat1, lat2, lon1, lon2;
  var d, crs12, crs21;
  var argacos;
  var a, invf;
  signlat1 = 1;
  signlat2 = 1;
  signlon1 = 1;
  signlon2 = 1;
  lat1 = Math.PI / 180 * signlat1 * parseFloat(getLat1);
  lat2 = Math.PI / 180 * signlat2 * parseFloat(getLat2);
  lon1 = Math.PI / 180 * signlon1 * parseFloat(getLon1);
  lon2 = Math.PI / 180 * signlon2 * parseFloat(getLon2);
  dc = 1.852;
  ellipse = { name:"WGS84", a:3443.918466522678, invf:298.257223563 };
  if(ellipse.name == "Sphere") {
    cd = crsdist(lat1, lon1, lat2, lon2);
    crs12 = cd.crs12 * (180 / Math.PI);
    crs21 = cd.crs21 * (180 / Math.PI);
    d = cd.d * (180 / Math.PI) * 60 * dc
  }else {
    cde = crsdist_ell(lat1, -lon1, lat2, -lon2, ellipse);
    crs12 = cde.crs12 * (180 / Math.PI);
    crs21 = cde.crs21 * (180 / Math.PI);
    d = cde.d * dc
  }
  var result = {
    player: crs12,
    enemy: crs21,
  }
  
  var distance = d;
  return result;
}

function crsdist(lat1, lon1, lat2, lon2) {
  if(lat1 + lat2 == 0 && Math.abs(lon1 - lon2) == Math.PI && Math.abs(lat1) != Math.PI / 180 * 90) {
    console.log("Course between antipodal points is undefined")
  }
  with(Math) {
    d = acos(sin(lat1) * sin(lat2) + cos(lat1) * cos(lat2) * cos(lon1 - lon2));
    if(d == 0 || lat1 == -(PI / 180) * 90) {
      crs12 = 2 * PI
    }else {
      if(lat1 == PI / 180 * 90) {
        crs12 = PI
      }else {
        argacos = (sin(lat2) - sin(lat1) * cos(d)) / (sin(d) * cos(lat1));
        if(sin(lon2 - lon1) < 0) {
          crs12 = acosf(argacos)
        }else {
          crs12 = 2 * PI - acosf(argacos)
        }
      }
    }
    if(d == 0 || lat2 == -(PI / 180) * 90) {
      crs21 = 0
    }else {
      if(lat2 == PI / 180 * 90) {
        crs21 = PI
      }else {
        argacos = (sin(lat1) - sin(lat2) * cos(d)) / (sin(d) * cos(lat2));
        if(sin(lon1 - lon2) < 0) {
          crs21 = acosf(argacos)
        }else {
          crs21 = 2 * PI - acosf(argacos)
        }
      }
    }
  }
  out = new MakeArray(0);
  out.d = d;
  out.crs12 = crs12;
  out.crs21 = crs21;
  return out
}
function crsdist_ell(glat1, glon1, glat2, glon2, ellipse) {
  a = ellipse.a;
  f = 1 / ellipse.invf;
  var r, tu1, tu2, cu1, su1, cu2, s1, b1, f1;
  var x, sx, cx, sy, cy, y, sa, c2a, cz, e, c, d;
  var EPS = 5.0E-11;
  var faz, baz, s;
  var iter = 1;
  var MAXITER = 100;
  if(glat1 + glat2 == 0 && Math.abs(glon1 - glon2) == Math.PI) {
    console.log("Course and distance between antipodal points is undefined");
    glat1 = glat1 + 1.0E-5
  }
  if(glat1 == glat2 && (glon1 == glon2 || Math.abs(Math.abs(glon1 - glon2) - 2 * Math.PI) < EPS)) {
    console.log("Points 1 and 2 are identical- course undefined");
    out = new MakeArray(0);
    out.d = 0;
    out.crs12 = 0;
    out.crs21 = Math.PI;
    return out
  }
  r = 1 - f;
  tu1 = r * Math.tan(glat1);
  tu2 = r * Math.tan(glat2);
  cu1 = 1 / Math.sqrt(1 + tu1 * tu1);
  su1 = cu1 * tu1;
  cu2 = 1 / Math.sqrt(1 + tu2 * tu2);
  s1 = cu1 * cu2;
  b1 = s1 * tu2;
  f1 = b1 * tu1;
  x = glon2 - glon1;
  d = x + 1;
  while(Math.abs(d - x) > EPS && iter < MAXITER) {
    iter = iter + 1;
    sx = Math.sin(x);
    cx = Math.cos(x);
    tu1 = cu2 * sx;
    tu2 = b1 - su1 * cu2 * cx;
    sy = Math.sqrt(tu1 * tu1 + tu2 * tu2);
    cy = s1 * cx + f1;
    y = atan2(sy, cy);
    sa = s1 * sx / sy;
    c2a = 1 - sa * sa;
    cz = f1 + f1;
    if(c2a > 0) {
      cz = cy - cz / c2a
    }
    e = cz * cz * 2 - 1;
    c = ((-3 * c2a + 4) * f + 4) * c2a * f / 16;
    d = x;
    x = ((e * cy * c + cz) * sy * c + y) * sa;
    x = (1 - c) * x * f + glon2 - glon1
  }
  faz = modcrs(atan2(tu1, tu2));
  baz = modcrs(atan2(cu1 * sx, b1 * cx - su1 * cu2) + Math.PI);
  x = Math.sqrt((1 / (r * r) - 1) * c2a + 1);
  x += 1;
  x = (x - 2) / x;
  c = 1 - x;
  c = (x * x / 4 + 1) / c;
  d = (0.375 * x * x - 1) * x;
  x = e * cy;
  s = ((((sy * sy * 4 - 3) * (1 - e - e) * cz * d / 6 - x) * d / 4 + cz) * sy * d + y) * c * a * r;
  out = new MakeArray(0);
  out.d = s;
  out.crs12 = faz;
  out.crs21 = baz;
  if(Math.abs(iter - MAXITER) < EPS) {
    console.log("Algorithm did not converge")
  }
  return out
}
function direct(lat1, lon1, crs12, d12) {
  var EPS = 5.0E-11;
  var dlon, lat, lon;
  if(Math.abs(Math.cos(lat1)) < EPS && !(Math.abs(Math.sin(crs12)) < EPS)) {
    console.log("Only N-S courses are meaningful, starting at a pole!")
  }
  lat = Math.asin(Math.sin(lat1) * Math.cos(d12) + Math.cos(lat1) * Math.sin(d12) * Math.cos(crs12));
  if(Math.abs(Math.cos(lat)) < EPS) {
    lon = 0
  }else {
    dlon = Math.atan2(Math.sin(crs12) * Math.sin(d12) * Math.cos(lat1), Math.cos(d12) - Math.sin(lat1) * Math.sin(lat));
    lon = mod(lon1 - dlon + Math.PI, 2 * Math.PI) - Math.PI
  }
  out = new MakeArray(0);
  out.lat = lat;
  out.lon = lon;
  return out
}
function direct_ell(glat1, glon1, faz, s, ellipse) {
  var EPS = 5.0E-11;
  var r, tu, sf, cf, b, cu, su, sa, c2a, x, c, d, y, sy, cy, cz, e;
  var glat2, glon2, baz, f;
  if(Math.abs(Math.cos(glat1)) < EPS && !(Math.abs(Math.sin(faz)) < EPS)) {
    console.log("Only N-S courses are meaningful, starting at a pole!")
  }
  a = ellipse.a;
  f = 1 / ellipse.invf;
  r = 1 - f;
  tu = r * Math.tan(glat1);
  sf = Math.sin(faz);
  cf = Math.cos(faz);
  if(cf == 0) {
    b = 0
  }else {
    b = 2 * atan2(tu, cf)
  }
  cu = 1 / Math.sqrt(1 + tu * tu);
  su = tu * cu;
  sa = cu * sf;
  c2a = 1 - sa * sa;
  x = 1 + Math.sqrt(1 + c2a * (1 / (r * r) - 1));
  x = (x - 2) / x;
  c = 1 - x;
  c = (x * x / 4 + 1) / c;
  d = (0.375 * x * x - 1) * x;
  tu = s / (r * a * c);
  y = tu;
  c = y + 1;
  while(Math.abs(y - c) > EPS) {
    sy = Math.sin(y);
    cy = Math.cos(y);
    cz = Math.cos(b + y);
    e = 2 * cz * cz - 1;
    c = y;
    x = e * cy;
    y = e + e - 1;
    y = (((sy * sy * 4 - 3) * y * cz * d / 6 + x) * d / 4 - cz) * sy * d + tu
  }
  b = cu * cy * cf - su * sy;
  c = r * Math.sqrt(sa * sa + b * b);
  d = su * cy + cu * sy * cf;
  glat2 = modlat(atan2(d, c));
  c = cu * cy - su * sy * cf;
  x = atan2(sy * sf, c);
  c = ((-3 * c2a + 4) * f + 4) * c2a * f / 16;
  d = ((e * cy * c + cz) * sy * c + y) * sa;
  glon2 = modlon(glon1 + x - (1 - c) * d * f);
  baz = modcrs(atan2(sa, b) + Math.PI);
  out = new MakeArray(0);
  out.lat = glat2;
  out.lon = glon2;
  out.crs21 = baz;
  return out
}
function Link() {
  type = new MakeArray(3);
  type[1] = "airport-info";
  type[2] = "navaid-info";
  type[3] = "fix-info";
  var query = type[document.spheroid.Fixtype.selectedIndex + 1];
  var ref = "http://www.airnav.com/cgi-bin/" + query + "?" + document.spheroid.Fix.value;
  var newWindow = window.open(ref, "");
  newWindow = window.open(ref, "")
}
function signlatlon(selection) {
  var sign;
  if(selection.selectedIndex == 0) {
    sign = 1
  }else {
    sign = -1
  }
  return sign
}
function MakeArray(n) {
  this.length = n;
  for(var i = 1;i <= n;i++) {
    this[i] = 0
  }
  return this
}
function dconv(selection) {
  dc = new MakeArray(3);
  dc[1] = 1;
  dc[2] = 1.852;
  dc[3] = 185200 / 160934.4;
  dc[4] = 185200 / 30.48;
  return dc[selection.selectedIndex + 1]
}
function ellipsoid(name, a, invf) {
  this.name = name;
  this.a = a;
  this.invf = invf
}
function getEllipsoid(selection) {
  no_selections = 10;
  ells = new MakeArray(no_selections);
  ells[1] = new ellipsoid("Sphere", 180 * 60 / Math.PI, "Infinite");
  ells[2] = new ellipsoid("WGS84", 6378.137 / 1.852, 298.257223563);
  ells[3] = new ellipsoid("NAD27", 6378.2064 / 1.852, 294.9786982138);
  ells[4] = new ellipsoid("International", 6378.388 / 1.852, 297);
  ells[5] = new ellipsoid("Krasovsky", 6378.245 / 1.852, 298.3);
  ells[6] = new ellipsoid("Bessel", 6377.397155 / 1.852, 299.1528);
  ells[7] = new ellipsoid("WGS72", 6378.135 / 1.852, 298.26);
  ells[8] = new ellipsoid("WGS66", 6378.145 / 1.852, 298.25);
  ells[9] = new ellipsoid("FAI sphere", 6371 / 1.852, 1E9);
  ells[10] = new ellipsoid("User", 0, 0);
  if(selection.selectedIndex + 1 == no_selections) {
    ells[no_selections].name = "User";
    ells[no_selections].a = document.spheroid.major_radius.value / 1.852;
    ells[no_selections].invf = document.spheroid.inverse_f.value;
    if(ells[no_selections].invf == "Infinite") {
      ells[no_selections].invf = 1E9
    }
  }else {
  }
  return ells[selection.selectedIndex + 1]
}
function parselatlon(instr) {
  var deg, min, sec, colonIndex, degstr, minstr, str;
  str = instr;
  colonIndex = str.indexOf(":");
  if(colonIndex == -1) {
    if(!isPosNumber(str)) {
      badLLFormat(instr);
      return 0
    }else {
      return parseFloat(str)
    }
  }
  degstr = str.substring(0, colonIndex);
  str = str.substring(colonIndex + 1, str.length);
  if(!isPosInteger(degstr)) {
    badLLFormat(instr);
    return 0
  }else {
    deg = parseFloat(degstr + ".0")
  }
  colonIndex = str.indexOf(":");
  if(colonIndex == -1) {
    if(!isPosNumber(str)) {
      badLLFormat(instr);
      return 0
    }else {
      min = parseFloat(str);
      if(min < 60) {
        return deg + parseFloat(str) / 60
      }else {
        badLLFormat(instr);
        return 0
      }
    }
  }
  minstr = str.substring(0, colonIndex) + ".0";
  str = str.substring(colonIndex + 1, str.length);
  if(!isPosNumber(minstr) || !isPosNumber(str)) {
    badLLFormat(instr);
    return 0
  }else {
    if(parseFloat(minstr) < 60 && parseFloat(str) < 60) {
      return deg + parseFloat(minstr) / 60 + parseFloat(str) / 3600
    }else {
      badLLFormat(instr);
      return 0
    }
  }
}
function badLLFormat(str) {
  console.log(str + " is an invalid lat/lon format\n" + "Use DD.DD DD:MM.MM or DD:MM:SS.SS")
}
function isPosInteger(instr) {
  str = "" + instr;
  for(var i = 0;i < str.length;i++) {
    var oneChar = str.charAt(i);
    if(oneChar < "0" || oneChar > "9") {
      return false
    }
  }
  return true
}
function isPosNumber(instr) {
  str = "" + instr;
  oneDecimal = false;
  for(var i = 0;i < str.length;i++) {
    var oneChar = str.charAt(i);
    if(oneChar == "." && !oneDecimal) {
      oneDecimal = true;
      continue
    }
    if(oneChar < "0" || oneChar > "9") {
      return false
    }
  }
  return true
}
function checkField(field) {
  var str = field.name;
  var latlon;
  latlon = parselatlon(field.value);
  if(str.substring(0, 3) == "lat") {
    if(latlon > 90) {
      console.log("Latitudes cannot exceed 90 degrees");
      field.focus();
      field.select()
    }
  }
  if(str.substring(0, 3) == "lon") {
    if(latlon > 180) {
      console.log("Longitudes cannot exceed 180 degrees");
      field.focus();
      field.select()
    }
  }
  return latlon
}
function acosf(x) {
  if(Math.abs(x) > 1) {
    x /= Math.abs(x)
  }
  return Math.acos(x)
}
function atan2(y, x) {
  var out;
  if(x < 0) {
    out = Math.atan(y / x) + Math.PI
  }
  if(x > 0 && y >= 0) {
    out = Math.atan(y / x)
  }
  if(x > 0 && y < 0) {
    out = Math.atan(y / x) + 2 * Math.PI
  }
  if(x == 0 && y > 0) {
    out = Math.PI / 2
  }
  if(x == 0 && y < 0) {
    out = 3 * Math.PI / 2
  }
  if(x == 0 && y == 0) {
    console.log("atan2(0,0) undefined");
    out = 0
  }
  return out
}
function mod(x, y) {
  return x - y * Math.floor(x / y)
}
function modlon(x) {
  return mod(x + Math.PI, 2 * Math.PI) - Math.PI
}
function modcrs(x) {
  return mod(x, 2 * Math.PI)
}
function modlat(x) {
  return mod(x + Math.PI / 2, 2 * Math.PI) - Math.PI / 2
}
function degtodm(deg, decplaces) {
  var deg1 = Math.floor(deg);
  var min = 60 * (deg - Math.floor(deg));
  /* var mins = format(min, decplaces); */
// 
//   if(mins.substring(0, 1) == "6" && mins > 59) {
//     deg1 += 1;
//     mins = format(0, decplaces)
//   }
  min = min+'';
  var mins = min.replace(/[^\d]/, '');
  return deg1 + "." + mins;
}
function format(expr, decplaces) {
  var str = "" + Math.round(eval(expr) * Math.pow(10, decplaces));
  while(str.length <= decplaces) {
    str = "0" + str
  }
  var decpoint = str.length - decplaces;
  return str.substring(0, decpoint) + "." + str.substring(decpoint, str.length)
}
function showProps(obj, objName) {
  var result = "";
  for(var i in obj) {
    result += objName + "." + i + " = " + obj[i] + "\n"
  }
  console.log(result)
}
;

