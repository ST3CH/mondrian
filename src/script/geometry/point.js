import Posn from 'script/geometry/posn';
import ui from 'script/ui/ui';
import dom from 'script/dom/dom';

/*

  Point



     o -----------
    /
   /
  /

  Tangible body for posn.
  Stored in PointsList for every shape.
  Comes in many flavors for a Path:
    MoveTo
    LineTo
    HorizTo
    VertiTo
    CurvePoint
      CurveTo
      SmoothTo

  This is the most heavily sub-classed class, even heavier than Monsvg.
  It's also the most heavily used, since all shapes are made of many of these.

  Needless to say, this is a very important class.
  Its efficiency basically decides the entire application's speed.
  (Not sure it's as good as it could be right now)

*/

export default class Point extends Posn {
  static initClass() {
  
    this.prototype.absoluteCached = undefined; //
  
    this.prototype.prec = null;
    this.prototype.succ = null;
  }

  constructor(x, y, owner) {
    super(x, y);


    this.x = x;
    this.y = y;
    this.owner = owner;
    this.constructArgs = arguments;
    if (((this.x == null)) && ((this.y == null))) { return; }


    // Robustness principle!
    // You can make a Point in many ways.
    //
    //   Posn: Give a posn, and it will just inherit the x and y positions
    //   Event:
    //     Give it an event with clientX and clientY
    //   Object:
    //     Give it a generic Object with an x and y
    //   String:
    //     Give it an SVG string like "M10 20"
    //
    // It will do what's most appropriate in each case; for the first three
    // it will just inherit x and y values from the input. In the third case
    // given an SVG string it will actually return a subclass of itself based
    // on what the string is.

    if (this.x instanceof Posn) {
      this.owner = this.y;
      this.y = this.x.y;
      this.x = this.x.x;
    } else if (this.x instanceof Object) {
      this.owner = this.y;
      if (this.x.clientX != null) {
        // ...then it's an Event object
        this.y = this.x.clientY;
        this.x = this.x.clientX;
      } else if ((this.x.x != null) && (this.x.y != null)) {
        // ...then it's some generic object
        this.y = this.x.y;
        this.x = this.x.x;
      }
    } else if (typeof this.x === "string") {
      console.trace();
      console.log('UNSUPPORTED');
    }

    if (isNaN(this.x)) { console.warn('NaN x'); }
    if (isNaN(this.y)) { console.warn('NaN y'); }

    this._flags = [];

    this.makeAntlers();
  }

  select() {
    this.show();
    this.showHandles();
    this.antlers.refresh();
    this.baseHandle.setAttribute('selected', '');
    return this;
  }

  deselect() {
    this.baseHandle.removeAttribute('selected');
    if (typeof this.hideHandles === 'function') {
      this.hideHandles();
    }
    this.hide();
    return this;
  }

  draw() {
    // Draw the main handle DOM object.
    this.$baseHandle = $('<div class="transform handle point"></div>');

    this.baseHandle = this.$baseHandle[0];
    // Set up the handle to have a connection to this elem

    if (this.at === undefined) {
      if (!(this instanceof AntlerPoint)) { debugger; }
    }

    this.baseHandle.setAttribute('at', this.at);
    if (this.owner != null) { this.baseHandle.setAttribute('owner', this.owner.metadata.uuid); }

    this.updateHandle(this.baseHandle, this.x, this.y);
    if (dom.ui != null) {
      dom.ui.appendChild(this.baseHandle);
    }

    return this;
  }


  makeAntlers() {
    let p2;
    if (this.succ != null) {
      p2 = (this.succ.p2 != null) ? this.succ.p2() : undefined;
    } else {
      p2 = null;
    }
    let p3 = (this.p3 != null) ? this.p3() : null;
    this.antlers = new Antlers(this, p3, p2);
    return this;
  }

  showHandles() {
    return this.antlers.show();
  }

  hideHandles() {
    return this.antlers.hide();
  }

  actionHint() {
    return this.baseHandle.setAttribute('action', '');
  }

  hideActionHint() {
    return this.baseHandle.removeAttribute('action');
  }


  updateHandle(handle, x, y) {
    if (handle == null) { handle = this.baseHandle; }
    if (x == null) { ({ x } = this); }
    if (y == null) { ({ y } = this); }
    if (handle === undefined) { return; }

    // Since Point objects actually affect the data for Paths but they always
    // need to be the same size on the UI, their zoom behavior
    // falls in the annotation category. (#1)
    //
    // That means we need to scale its UI rep without actually affecting
    // the source of its coordinates. In this case, we simply scale the
    // left and top attributes of the DOM point handle.

    handle.style.left = x * ui.canvas.zoom;
    handle.style.top = y * ui.canvas.zoom;
    return this;
  }


  inheritPosition(from) {
    // Maintain linked-list order in a PointsList
    this.at         = from.at;
    this.prec       = from.prec;
    this.succ       = from.succ;
    this.prec.succ  = this;
    this.succ.prec  = this;
    this.owner      = from.owner;
    if (from.baseHandle != null) { this.baseHandle = from.baseHandle; }
    return this;
  }



  nudge(x, y, checkForFirstOrLast) {
    if (checkForFirstOrLast == null) { checkForFirstOrLast = true; }
    let old = this.clone();
    super.nudge(x, y);
    if (this.antlers != null) {
      this.antlers.nudge(x, y);
    }
    this.updateHandle();

    if (this.owner.type === 'path') {
      if (checkForFirstOrLast && this.owner.points.closed) {
        // Check if this is the point overlapping the original MoveTo.
        if ((this === this.owner.points.first) && this.owner.points.last.equal(old)) {
          return this.owner.points.last.nudge(x, y, false);
        } else if ((this === this.owner.points.last) && this.owner.points.first.equal(old)) {
          return this.owner.points.first.nudge(x, y, false);
        }
      }
    }
  }


  rotate(a, origin) {
    super.rotate(a, origin);
    if (this.antlers != null) {
      this.antlers.rotate(a, origin);
    }
    return this.updateHandle();
  }


  scale(x, y, origin, angle) {
    super.scale(x, y, origin, angle);
    if (this.antlers != null) {
      this.antlers.scale(x, y, origin, angle);
    }
    this.updateHandle();
    return this;
  }


  replaceWith(point) {
    return this.owner.points.replace(this, point);
  }


  toPosn() {
    return new Posn(this.x, this.y);
  }


  toLineSegment() {
    return new LineSegment(this.prec, this);
  }


  /*

    Linked list action

  */

  setSucc(succ) {
    this.succ = succ;
    return succ.prec = this;
  }

  setPrec(prec) {
    return prec.setSucc(this);
  }


  /*

   Visibility functions for the UI

  */

  show() {
    if ((this.baseHandle == null)) { return; }
    if (!this.baseHandle) {
      this.draw();
    }
    this.baseHandle.style.display = 'block';
    return this.baseHandle.style.opacity = 1;
  }


  hide(force) {
    if (force == null) { force = false; }
    if ((this.baseHandle == null)) { return; }
    if (!this.baseHandle.hasAttribute('selected') || force) {
      this.baseHandle.style.opacity = 0;
      this.baseHandle.removeAttribute('action');
      this.hideHandles();
      return this.unhover();
    }
  }


  hover() {
    if (this.baseHandle != null) {
      this.baseHandle.setAttribute('hover', '');
    }
    if ((this.baseHandle == null)) { console.log("base handle missing"); }

    if (this.at === 0) {
      return this.owner.points.last.baseHandle.setAttribute('hover', '');
    } else if (this === this.owner.points.last) {
      return this.owner.points.first.baseHandle.setAttribute('hover', '');
    }
  }


  unhover() {
    return (this.baseHandle != null ? this.baseHandle.removeAttribute('hover') : undefined);
  }


  clear() {
    this.baseHandle.style.display = 'none';
    return this;
  }


  unclear() {
    this.baseHandle.style.display = 'block';
    return this;
  }


  remove() {
    if (this.antlers != null) {
      this.antlers.hide();
    }
    return (this.baseHandle != null ? this.baseHandle.remove() : undefined);
  }


  toStringWithZoom() {
    this.multiplyByMutable(ui.canvas.zoom);
    let str = this.toString();
    this.multiplyByMutable((1 / ui.canvas.zoom));
    return str;
  }

  flag(flag) { return this._flags.ensure(flag); }

  unflag(flag) { return this._flags.remove(flag); }

  flagged(flag) { return this._flags.has(flag); }

  annotate(color, radius) {
    return ui.annotations.drawDot(this, color, radius);
  }
}
Point.initClass();



/*

  Antlers

     \
        \ O  -  (succx, succy)
          \\
            \
             \
              o
               \
                \
                \\
                \ O  -  (basex, basey)
                |
                |
               /
              /


  Control handles for any vector Point. Edits base's x3 and base's succ's p2
  Each CurvePoint gets one of these. It keeps track of coordinates locally so we can
  draw these pre-emptively. For example, if you take the Pen tool and just drag a curve point right away,
  those curves don't exist yet but they come into play as soon as you add another point
  (...which will have to be a CurvePoint even if it's a static click)

  This class handles the GUI and updating the base and its succ's x2 y2 x3 y3. :)

*/





export class Antlers {
  static initClass() {
  
    this.prototype.angleLockThreshold = 0.5;
  
    this.prototype.visible = false;
  }

  constructor(base, basep3, succp2) {
    // I/P: base, a CurvePoint
    //      basex3 - either a Posn or null
    //      succx2 - either a Posn or null

    // Decide whether or not to lock the angle
    // (ensure points are always on a straight line)

    this.base = base;
    this.basep3 = basep3;
    this.succp2 = succp2;
    if ((this.basep3 != null) && (this.succp2 != null)) {
      let diff = Math.abs(this.basep3.angle360(this.base) - this.succp2.angle360(this.base));
      this.lockAngle = diff.within(this.angleLockThreshold, 180);
    } else {
      this.lockAngle = false;
    }
  }

  commit() {
    // Export the data to the element
    if (this.basep3 != null) {
      this.base.x3 = this.basep3.x;
      this.base.y3 = this.basep3.y;
    }
    if ((this.succp2 != null) && this.succ()) {
      this.succ().x2 = this.succp2.x;
      this.succ().y2 = this.succp2.y;
    }
    return this;
  }

  importNewSuccp2(succp2) {
    this.succp2 = succp2;
    if (this.succp2 != null) {
      this.basep3 = this.succp2.reflect(this.base);
    }
    return this.commit().refresh();
  }

  killSuccp2() {
    this.succp2 = new Posn(this.base.x, this.base.y);
    return this.commit().refresh();
  }

  succ() {
    return this.base.succ;
  }

  refresh() {
    if (!this.visible) { return; }
    return this.hide().show();
  }

  show() {
    this.hide();
    this.visible = true;
    // Actually draws it, instead of just revealing it.
    // We don't keep the elements for this unless they're actually being shown.
    // We refresh it whenever we want it.
    if (this.basep3 != null) {
      this.basep = new AntlerPoint(this.basep3.x, this.basep3.y, this.base.owner, this, -1);
    }

    if (this.succp2 != null) {
      this.succp = new AntlerPoint(this.succp2.x, this.succp2.y, this.base.owner, this, 1);
    }

    return (() => this.hide());
  }

  hide() {
    this.visible = false;
    // Removes elements from DOM to avoid needlessly updating them.
    if (this.basep != null) {
      this.basep.remove();
    }
    if (this.succp != null) {
      this.succp.remove();
    }
    if (this.base.owner.antlerPoints != null) {
      this.base.owner.antlerPoints.remove([this.basep, this.succp]);
    }
    return this;
  }

  redraw() {
    this.hide();
    this.show();
    return this;
  }

  hideTemp(p) {
    return __guard__((p === 2 ? this.succp : this.basep), x => x.hideTemp());
  }

  nudge(x, y) {

    if (this.basep3 != null) {
      this.basep3.nudge(x, y);
    }
    if (this.succp2 != null) {
      this.succp2.nudge(x, y);
    }
    if (this.succ() instanceof CurvePoint) {
      this.succ().x2 += x;
      this.succ().y2 -= y;
    }
    return this.commit();
  }

  scale(x, y, origin) {
    // When the shape is closed, this gets handled by the last point's antlers.

    if (this.basep3 != null) {
      this.basep3.scale(x, y, origin);
    }
    return (this.succp2 != null ? this.succp2.scale(x, y, origin) : undefined);
  }

  rotate(a, origin) {

    if (this.basep3 != null) {
      this.basep3.rotate(a, origin);
    }
    if (this.succp2 != null) {
      this.succp2.rotate(a, origin);
    }
    return this;
  }

  other(p) {
    if (p === this.succp) { return this.basep; } else { return this.succp; }
  }

  angleDiff(a, b) {
    let x = a - b;
    if (x < 0) {
      x += 360;
    }
    return x;
  }

  flatten() {
    let ahead, compensate;
    if ((this.succp2 == null) || (this.basep3 == null)) { return; }

    // Whichever one's ahead keeps moving ahead


    let angleSuccp2 = this.succp2.angle360(this.base);
    let angleBasep3 = this.basep3.angle360(this.base);

    let p2p3d = this.angleDiff(angleSuccp2, angleBasep3);
    let p3p2d = this.angleDiff(angleBasep3, angleSuccp2);

    if (p2p3d < p3p2d) {
      ahead = "p2";
    } else {
      ahead = "p3";
    }

    if (ahead === "p2") {
      // Move p2 forward, p3 back
      if (p2p3d < 180) {
       compensate = (180 - p2p3d) / 2;
       this.succp2 = this.succp2.rotate(compensate, this.base);
       return this.basep3 = this.basep3.rotate(-compensate, this.base);
     }
    } else {
      // Move p2 forward, p3 back
      if (p3p2d < 180) {
       compensate = (180 - p3p2d) / 2;
       this.succp2 = this.succp2.rotate(-compensate, this.base);
       return this.basep3 = this.basep3.rotate(compensate, this.base);
     }
    }
  }
}
Antlers.initClass();

export class AntlerPoint extends Point {
  constructor(x, y, owner, family, role) {
    // I/P: x: int
    //      y: int
    //      owner: Monsvg
    //      family: Antlers
    //      role: int, -1 or 1 (-1 = base p3, 1 = succ p2)
    super(x, y, owner);
    this.x = x;
    this.y = y;
    this.owner = owner;
    this.family = family;
    this.role = role;
    this.draw();
    this.baseHandle.className += ' bz-ctrl';
    this.line = ui.annotations.drawLine(this.zoomedc(), this.family.base.zoomedc());
    if (this.owner.antlerPoints != null) {
      this.owner.antlerPoints.push(this);
    }
  }

  succ() { return this.family.base.succ; }

  base() { return this.family.base; }

  hideTemp() {
    this.line.rep.style.display = 'none';
    this.baseHandle.style.display = 'none';
    return () => {
      this.line.rep.style.display = 'block';
      return this.baseHandle.style.display = 'block';
    };
  }

  remove() {
    this.line.remove();
    return super.remove(...arguments);
  }


  nudge(x, y) {

    if (!this.family.lockAngle) {
      super.nudge(x, y);
      this.persist();
    } else {
      let oldangle = this.angle360(this.family.base);
      super.nudge(x, y);

      let newangle = this.angle360(this.family.base);
      __guard__(this.family.other(this), x1 => x1.rotate(newangle - oldangle, this.family.base));
      this.persist();
    }

    if ((this.role === -1) && this.family.base.succ instanceof SmoothTo) {
      let s = this.family.base.succ;
      return s.replaceWith(s.toCurveTo());
    }
  }


  scale(x, y, origin) {
    super.scale(x, y, origin);
    return this.persist();
  }

  rotate(a, origin) {
    super.rotate(a, origin);
    return this.persist();
  }

  persist() {
    if (this.role === -1) {// or @family.lockedTogether
      this.family.basep3.copy(this);
    }

    if (this.role === 1) {// or @family.lockedTogether
      this.family.succp2.copy(this);
    }

    if (this.family.base === this.owner.points.last) {
      // Special case for when they are moving the last point's
      // antlers. We need to make the same changes on the first point's
      // antlers IF THE SHAPE IS CLOSED.

      let { first } = this.owner.points;

      if (this.family.base.equal(first)) {
        // Make sure the first point's antlers
        // have the same succp2 and basep3 as this does
        //
        // Copy this antler's succp2 and basep3 and give them to
        // the first point's antlers as well.
        first.antlers.succp2 = this.family.succp2.clone();
        first.antlers.basep3 = this.family.basep3.clone();
        first.antlers.commit();
      }
    }

    this.line.absorbA(this.family.base.zoomedc());
    this.line.absorbB(this.zoomedc());

    this.line.commit();

    return this.family.commit();
  }
}



function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}