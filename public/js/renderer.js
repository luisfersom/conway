define(['jquery'], function($) {
  var Renderer = function(app) {
    this.app = app;
    this.game = app.game;
    this.gameClient = app.gameClient;
    this.playerManager = app.playerManager;
    this.config = app.config;
    this.grid = app.game.grid;
    this.width = app.width;
    this.height = app.height;
    this.cellSize = this.config.cellSize;
    this.spacing = this.config.cellSpacing;
    this.hoveredCell = undefined;
    this.flaggedCells = [];

    this.pixelWidth = this.width * (this.cellSize + this.spacing) + 1;
    this.pixelHeight = this.height * (this.cellSize + this.spacing) + 1;

    this.nextTickBarUpdate = Date.now() + 100;
  };

  Renderer.prototype.init = function() {
    var cellSize = this.cellSize,
      cells = this.grid.getCells(),
      _this = this;

    this.canvas = document.getElementById('c');
    this.context = this.canvas.getContext('2d');

    this.gameEl = this.canvas.parentElement;
    this.tickBar = $('.tickbar');
    this.tickBarFill = $(this.tickBar).find('.tickbarfill');

    // prevent text selection when interacting with the canvas
    this.canvas.addEventListener('selectstart', function(e) {
      event.preventDefault();
    });

    var that = this;

    // keep track of the mouse position on the canvas
    this.canvas.addEventListener('mousemove', this._handleMouseMove.bind(this), false);

    // repaint the hovered cell when the mouse leaves the canvas
    this.canvas.addEventListener('mouseleave', this._handleMouseLeave.bind(this), false);

    // make the cell living when clicked
    this.canvas.addEventListener('click', this._handleClick.bind(this), false);

    // attempt to place flagged cells when the place cells button is pushed
    $('#controls .place-cells').on('click', this._handlePlaceCells.bind(this));

    this.canvas.width = this.pixelWidth;
    this.canvas.height = this.pixelHeight;

    $(this.gameEl).width(this.pixelWidth);
    $(this.tickBar).width(this.pixelWidth);

    this._drawGrid();
  };

  Renderer.prototype.getCellFromPosition = function(x, y) {
    var cellSize = this.cellSize,
      spacing = this.spacing,
      cellX = Math.floor((x - 1) / (cellSize + spacing)),
      cellY = Math.floor((y - 1) / (cellSize + spacing));

    return this.grid.getCell(cellX, cellY);
  };

  Renderer.prototype.clear = function() {
    this.context.clearRect(0, 0, this.pixelWidth, this.pixelHeight);
  };

  Renderer.prototype.render = function() {
    var i,
      cells = this.grid.getCells(),
      l = cells.length;

    this.clear();
    this._drawGrid();

    // draw all cells, set clean
    for (i = 0; i < l; i++) {
      this._drawCell(cells[i]);
      cells[i].setClean();
    }
  };

  Renderer.prototype.renderChanges = function() {
    var i,
      now = Date.now(),
      cells = this.grid.getCells(),
      l = cells.length;

    for (i = 0; i < l; i++) {
      if (cells[i].isDirty()) {
        this._drawCell(cells[i]);
        cells[i].setClean();
      }
    }

    if (this.nextTickBarUpdate <= now) {
      this.updateTickBar(this.game.percentageOfTick());
      this.nextTickBarUpdate = now + 100;
    }
  };

  Renderer.prototype.updateTickBar = function(percent) {
    var nextWidth = this.pixelWidth * percent;

    if (nextWidth < $(this.tickBarFill).width()) {
      // going back to zero
      $(this.tickBarFill).removeClass('moving');
    } else if (!$(this.tickBarFill).hasClass('moving')) {
      $(this.tickBarFill).addClass('moving');
    }

    $(this.tickBarFill).width(nextWidth);

  };

  Renderer.prototype.setAccentColor = function(color) {
    this.color = color;

    this._setTickBarColor(color);
  };

  Renderer.prototype._drawGrid = function() {
    var i,
      config = this.config,
      context = this.context,
      cellSize = this.cellSize,
      spacing = this.spacing;

    for (i = 0; i < this.height; i++) {
      context.lineWidth = spacing;
      context.beginPath();
      context.moveTo(0, i * (cellSize + spacing) + 0.5);
      context.lineTo(this.pixelWidth, i * (cellSize + spacing) + 0.5);
      context.strokeStyle = 'rgba(0,0,0,1)';
      context.stroke();
    }

    for (i = 0; i < this.width; i++) {
      context.beginPath();
      context.moveTo(i * (cellSize + spacing) + 0.5, 0);
      context.lineTo(i * (cellSize + spacing) + 0.5, this.pixelHeight);
      context.stroke();
    }

    // finish the border  
    context.beginPath();
    context.moveTo(this.pixelWidth - 0.5, 0);
    context.lineTo(this.pixelWidth - 0.5, this.pixelHeight);
    context.stroke();

    context.beginPath();
    context.moveTo(0, this.pixelHeight - 0.5);
    context.lineTo(this.pixelWidth - 0.5, this.pixelHeight - 0.5);
    context.stroke();
  };

  Renderer.prototype._drawCell = function(cell) {
    // return if the cell was made undefined by _handleMouseLeave
    if (cell === undefined) {
      return;
    }

    var config = this.config,
      context = this.context,
      cellSize = this.cellSize,
      spacing = this.spacing,
      x1 = cell.x * (cellSize + spacing) + 1,
      y1 = cell.y * (cellSize + spacing) + 1;

    if (!cell.alive) {
      context.fillStyle = config.deadCellColor;
    } else {
      context.fillStyle = this.playerManager.getPlayer(cell.playerId).color;      
    }
    context.fillRect(x1, y1, cellSize, cellSize);

    if (this._isFlaggedCell(cell)) {
      this._drawFramedCell(cell);
    }
  };

  Renderer.prototype._drawFramedCell = function(cell) {
    if (cell === undefined) {
      return;
    }

    var context = this.context,
      cellSize = this.cellSize,
      spacing = this.spacing,
      x1 = cell.x * (cellSize + spacing) + 1.5,
      y1 = cell.y * (cellSize + spacing) + 1.5;

    context.lineWidth = 1.5;
    context.strokeStyle = this.color;
    context.strokeRect(x1 + .5, y1 + .5, cellSize - 2, cellSize - 2);
  };

  Renderer.prototype._isFlaggedCell = function(cell) {
    for (var i = 0; i < this.flaggedCells.length; i++) {
      if (cell.equals(this.flaggedCells[i])) {
        return true;
      }
    }

    return false;
  };

  Renderer.prototype._handleClick = function(event) {
    var clickedCell = this.getCellFromPosition(this.lastX, this.lastY),
      cells = [
        {
          x: clickedCell.x,
          y: clickedCell.y
        }
      ];

    if (!this._isFlaggedCell(clickedCell)) {
      this.flaggedCells.push(clickedCell);
      clickedCell.setDirty();
    } else {
      // remove the cell
      for (var i = 0; i < this.flaggedCells.length; i++) {
        if (clickedCell.equals(this.flaggedCells[i])) {
          this.flaggedCells.splice(i, 1);
          clickedCell.setDirty();
          break;
        }
      }
    }
  };

  Renderer.prototype._handleMouseLeave = function(event) {
    var oldCell = this.hoveredCell;
    this.hoveredCell = undefined;
    this._drawCell(oldCell);
  };

  Renderer.prototype._handleMouseMove = function(event) {
    this.lastX = event.offsetX || (event.pageX - this.canvas.offsetLeft);
    this.lastY = event.offsetY || (event.pageY - this.canvas.offsetTop);

    var oldCell = this.hoveredCell;
    this.hoveredCell = this.getCellFromPosition(this.lastX, this.lastY);

    this._drawCell(oldCell);
    this._drawFramedCell(this.hoveredCell);
  };

  Renderer.prototype._handlePlaceCells = function(event) {
    this.gameClient.placeLiveCells(this.flaggedCells);
    this.flaggedCells = [];

    event.preventDefault();
  };

  Renderer.prototype._setTickBarColor = function(color) {
    $(this.tickBarFill).css('background', color);
  };

  return Renderer;
});