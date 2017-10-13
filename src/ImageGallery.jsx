import React from 'react';
import Swipeable from 'react-swipeable';
import throttle from 'lodash.throttle';
import equal from 'deep-equal';

const screenChangeEvents = [
  'fullscreenchange',
  'msfullscreenchange',
  'mozfullscreenchange',
  'webkitfullscreenchange'
];

export default class ImageGallery extends React.Component {

  constructor(props) {
    super(props);

    const {
      items,
      featuredItem,
      minItemsPerLine,
      multilineThumbnailsLayout,
      thumbnailPosition
    } = this.props;

    const isMultilineLayoutActive = multilineThumbnailsLayout &&
      items.length >= minItemsPerLine * 2 &&
      (thumbnailPosition === 'bottom' || thumbnailPosition === 'top');

    const isFeaturedItemActive = featuredItem != null &&
      (thumbnailPosition === 'bottom' || thumbnailPosition === 'top');

    this.state = {
      currentIndex: props.startIndex,
      thumbsTranslate: 0,
      offsetPercentage: 0,
      galleryWidth: 0,
      thumbnailsWrapperWidth: 0,
      thumbnailsWrapperHeight: 0,
      isFullscreen: false,
      isPlaying: false,
      isMultilineLayoutActive,
      isFeaturedItemActive
    };

    if (props.lazyLoad) {
      this._lazyLoaded = [];
      // an array of URLs to images that were loaded successfully
      this._itemsLazyLoadedSuccessfully = [];
      // an array of thumbnails that were lazyloaded
      this._lazyLoadedThumbnails = [];
    }
  }

  static propTypes = {
    items: React.PropTypes.array.isRequired,
    featuredItem: React.PropTypes.object,
    showNav: React.PropTypes.bool,
    autoPlay: React.PropTypes.bool,
    lazyLoad: React.PropTypes.bool,
    infinite: React.PropTypes.bool,
    minItemsPerLine: React.PropTypes.number,
    multilineThumbnailsLayout: React.PropTypes.bool,
    showIndex: React.PropTypes.bool,
    showBullets: React.PropTypes.bool,
    showThumbnails: React.PropTypes.bool,
    showPlayButton: React.PropTypes.bool,
    showFullscreenButton: React.PropTypes.bool,
    slideOnThumbnailHover: React.PropTypes.bool,
    disableThumbnailScroll: React.PropTypes.bool,
    disableArrowKeys: React.PropTypes.bool,
    disableSwipe: React.PropTypes.bool,
    defaultImage: React.PropTypes.string,
    indexSeparator: React.PropTypes.string,
    thumbnailPosition: React.PropTypes.string,
    startIndex: React.PropTypes.number,
    slideDuration: React.PropTypes.number,
    slideInterval: React.PropTypes.number,
    onSlide: React.PropTypes.func,
    onScreenChange: React.PropTypes.func,
    onPause: React.PropTypes.func,
    onPlay: React.PropTypes.func,
    onClick: React.PropTypes.func,
    onImageLoad: React.PropTypes.func,
    onImageError: React.PropTypes.func,
    onThumbnailError: React.PropTypes.func,
    renderCustomControls: React.PropTypes.func,
    renderLeftNav: React.PropTypes.func,
    renderRightNav: React.PropTypes.func,
    renderPlayPauseButton: React.PropTypes.func,
    renderFullscreenButton: React.PropTypes.func,
    renderItem: React.PropTypes.func,
  };

  static defaultProps = {
    items: [],
    featuredItem: {},
    showNav: true,
    autoPlay: false,
    lazyLoad: false,
    infinite: true,
    minItemsPerLine: 3,
    multilineThumbnailsLayout: false,
    showIndex: false,
    showBullets: false,
    showThumbnails: true,
    showPlayButton: true,
    showFullscreenButton: true,
    slideOnThumbnailHover: false,
    disableThumbnailScroll: false,
    disableArrowKeys: false,
    disableSwipe: false,
    indexSeparator: ' / ',
    thumbnailPosition: 'bottom',
    startIndex: 0,
    slideDuration: 450,
    slideInterval: 3000,
    renderLeftNav: (onClick, disabled) => {
      return (
        <button
          type='button'
          className='image-gallery-left-nav'
          disabled={disabled}
          onClick={onClick}
          aria-label='Previous Slide'
        />
      );
    },
    renderRightNav: (onClick, disabled) => {
      return (
        <button
          type='button'
          className='image-gallery-right-nav'
          disabled={disabled}
          onClick={onClick}
          aria-label='Next Slide'
        />
      );
    },
    renderPlayPauseButton: (onClick, isPlaying) => {
      return (
        <button
          type='button'
          className={
            `image-gallery-play-button${isPlaying ? ' active' : ''}`}
          onClick={onClick}
          aria-label='Play or Pause Slideshow'
        />
      );
    },
    renderFullscreenButton: (onClick, isFullscreen) => {
      return (
        <button
          type='button'
          className={
            `image-gallery-fullscreen-button${isFullscreen ? ' active' : ''}`}
          onClick={onClick}
          aria-label='Open Fullscreen'
        />
      );
    },
  };

  componentWillReceiveProps(nextProps) {
    const {
      items,
      featuredItem,
      minItemsPerLine,
      multilineThumbnailsLayout,
      thumbnailPosition
    } = nextProps;

    if (this.props.disableArrowKeys !== nextProps.disableArrowKeys) {
      if (nextProps.disableArrowKeys) {
        window.removeEventListener('keydown', this._handleKeyDown);
      } else {
        window.addEventListener('keydown', this._handleKeyDown);
      }
    }

    if (nextProps.lazyLoad &&
      (!this.props.lazyLoad || !equal(this.props.items, nextProps.items))) {
      this._lazyLoaded = [];
      this._lazyLoadedThumbnails = [];
    }

    const isMultilineLayoutActive = multilineThumbnailsLayout &&
      items.length >= minItemsPerLine * 2 &&
      (thumbnailPosition === 'bottom' || thumbnailPosition === 'top');

    const isFeaturedItemActive = featuredItem != null &&
      (thumbnailPosition === 'bottom' || thumbnailPosition === 'top');

    this.setState({
      isMultilineLayoutActive,
      isFeaturedItemActive
    });
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.thumbnailPosition !== this.props.thumbnailPosition ||
        prevProps.showThumbnails !== this.props.showThumbnails ||
        prevState.thumbnailsWrapperHeight !== this.state.thumbnailsWrapperHeight ||
        prevState.thumbnailsWrapperWidth !== this.state.thumbnailsWrapperWidth) {
      this._handleResize();
    }

    if (prevState.currentIndex !== this.state.currentIndex) {
      if (this.props.onSlide) {
        this.props.onSlide(this.state.currentIndex);
      }

      this._updateThumbnailTranslate(prevState);
    }

    if (prevProps.slideDuration !== this.props.slideDuration) {
      this.slideToIndex = throttle(this._unthrottledSlideToIndex,
                                   this.props.slideDuration,
                                   {trailing: false});
    }
  }

  componentWillMount() {
    // Used to update the throttle if slideDuration changes
    this._unthrottledSlideToIndex = this.slideToIndex.bind(this);
    this.slideToIndex = throttle(this._unthrottledSlideToIndex,
                                 this.props.slideDuration,
                                {trailing: false});

    this._handleResize = this._handleResize.bind(this);
    this._handleScreenChange = this._handleScreenChange.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._thumbnailDelay = 300;
  }

  componentDidMount() {
    this._handleResize();

    if (this.props.autoPlay) {
      this.play();
    }
    if (!this.props.disableArrowKeys) {
      window.addEventListener('keydown', this._handleKeyDown);
    }
    window.addEventListener('resize', this._handleResize);
    this._onScreenChangeEvent();
  }

  componentWillUnmount() {
    if (!this.props.disableArrowKeys) {
      window.removeEventListener('keydown', this._handleKeyDown);
    }
    window.removeEventListener('resize', this._handleResize);
    this._offScreenChangeEvent();

    if (this._intervalId) {
      window.clearInterval(this._intervalId);
      this._intervalId = null;
    }

    if (this._resizeTimer) {
      window.clearTimeout(this._resizeTimer);
    }
  }

  play(callback = true) {
    if (!this._intervalId) {
      const {slideInterval, slideDuration} = this.props;
      this.setState({isPlaying: true});
      this._intervalId = window.setInterval(() => {
        if (!this.state.hovering) {
          if (!this.props.infinite && !this._canSlideRight()) {
            this.pause();
          } else {
            this.slideToIndex(this.state.currentIndex + 1);
          }
        }
      }, Math.max(slideInterval, slideDuration));

      if (this.props.onPlay && callback) {
        this.props.onPlay(this.state.currentIndex);
      }
    }

  }

  pause(callback = true) {
    if (this._intervalId) {
      window.clearInterval(this._intervalId);
      this._intervalId = null;
      this.setState({isPlaying: false});

      if (this.props.onPause && callback) {
        this.props.onPause(this.state.currentIndex);
      }
    }
  }

  fullScreen() {
    const gallery = this._imageGallery;

    if (gallery.requestFullscreen) {
      gallery.requestFullscreen();
    } else if (gallery.msRequestFullscreen) {
      gallery.msRequestFullscreen();
    } else if (gallery.mozRequestFullScreen) {
      gallery.mozRequestFullScreen();
    } else if (gallery.webkitRequestFullscreen) {
      gallery.webkitRequestFullscreen();
    } else {
      // fallback to fullscreen modal for unsupported browsers
      this.setState({modalFullscreen: true});
      // manually call because browser does not support screenchange events
      if (this.props.onScreenChange) {
        this.props.onScreenChange(true);
      }
    }

    this.setState({isFullscreen: true});

  }

  exitFullScreen = () => {
    if (this.state.isFullscreen) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      } else {
        // fallback to fullscreen modal for unsupported browsers
        this.setState({modalFullscreen: false});
        // manually call because browser does not support screenchange events
        if (this.props.onScreenChange) {
          this.props.onScreenChange(false);
        }
      }

      this.setState({isFullscreen: false});

    }
  }

  slideToIndex(index, event) {
    const {currentIndex} = this.state;

    if (event) {
      if (this._intervalId) {
        // user triggered event while ImageGallery is playing, reset interval
        this.pause(false);
        this.play(false);
      }
    }

    let slideCount = this.props.items.length - 1;
    let nextIndex = index;

    if (index < 0) {
      nextIndex = slideCount;
    } else if (index > slideCount) {
      nextIndex = 0;
    }

    this.setState({
      previousIndex: currentIndex,
      currentIndex: nextIndex,
      offsetPercentage: 0,
      style: {
        transition: `transform ${this.props.slideDuration}ms ease-out`
      }
    });

  }

  getCurrentIndex() {
    return this.state.currentIndex;
  }

  _handleScreenChange() {
    /*
      handles screen change events that the browser triggers e.g. esc key
    */
    const fullScreenElement = document.fullscreenElement ||
      document.msFullscreenElement ||
      document.mozFullScreenElement ||
      document.webkitFullscreenElement;

    if (this.props.onScreenChange) {
      this.props.onScreenChange(fullScreenElement);
    }

    this.setState({isFullscreen: !!fullScreenElement});
  }

  _onScreenChangeEvent() {
    screenChangeEvents.map(eventName => {
      document.addEventListener(eventName, this._handleScreenChange);
    });
  }

  _offScreenChangeEvent() {
    screenChangeEvents.map(eventName => {
      document.removeEventListener(eventName, this._handleScreenChange);
    });
  }

  _toggleFullScreen() {
    if (this.state.isFullscreen) {
      this.exitFullScreen();
    } else {
      this.fullScreen();
    }
  }

  _togglePlay() {
    if (this._intervalId) {
      this.pause();
    } else {
      this.play();
    }
  }

  _handleResize() {
    // delay initial resize to get the accurate this._imageGallery height/width
    this._resizeTimer = window.setTimeout(() => {
      if (this._imageGallery) {
        this.setState({
          galleryWidth: this._imageGallery.offsetWidth
        });
      }

      // adjust thumbnail container when thumbnail width or height is adjusted
      if (this.state.currentIndex > 0) {
        const index = this.state.isMultilineLayoutActive ?
          this._getImageColumnByIndex(this.props.items, this.state.currentIndex) :
          this.state.currentIndex;
        const maxRowSize = this.state.isMultilineLayoutActive ?
          Math.ceil(this.props.items.length / 2) : this.props.items.length;
        this._setThumbsTranslate(-this._getThumbsTranslate(maxRowSize, index));
      }

      if (this._imageGallerySlideWrapper) {
        this.setState({
          gallerySlideWrapperWidth: this._imageGallerySlideWrapper.offsetWidth,
          gallerySlideWrapperHeight: this._imageGallerySlideWrapper.offsetHeight
        });
      }

      if (this._thumbnailsWrapper) {
        if (this._isThumbnailHorizontal()) {
          this.setState({thumbnailsWrapperHeight: this._thumbnailsWrapper.offsetHeight});
        } else {
          this.setState({thumbnailsWrapperWidth: this._thumbnailsWrapper.offsetWidth});
        }
      }
    }, 500);
  }

  _isThumbnailHorizontal() {
    const { thumbnailPosition } = this.props;
    return thumbnailPosition === 'left' || thumbnailPosition === 'right';
  }

  _handleKeyDown(event) {
    const LEFT_ARROW = 37;
    const RIGHT_ARROW = 39;
    const key = parseInt(event.keyCode || event.which || 0);

    switch(key) {
      case LEFT_ARROW:
        if (this._canSlideLeft() && !this._intervalId) {
          this._slideLeft();
        }
        break;
      case RIGHT_ARROW:
        if (this._canSlideRight() && !this._intervalId) {
          this._slideRight();
        }
        break;
    }
  }

  _handleMouseOverThumbnails(index) {
    if (this.props.slideOnThumbnailHover) {
      this.setState({hovering: true});
      if (this._thumbnailTimer) {
        window.clearTimeout(this._thumbnailTimer);
        this._thumbnailTimer = null;
      }
      this._thumbnailTimer = window.setTimeout(() => {
        this.slideToIndex(index);
      }, this._thumbnailDelay);
    }
  }

  _handleMouseLeaveThumbnails() {
    if (this._thumbnailTimer) {
      window.clearTimeout(this._thumbnailTimer);
      this._thumbnailTimer = null;
      if (this.props.autoPlay === true) {
        this.play(false);
      }
    }
    this.setState({hovering: false});
  }

  _handleImageError(event) {
    if (this.props.defaultImage &&
        event.target.src.indexOf(this.props.defaultImage) === -1) {
      event.target.src = this.props.defaultImage;
    }
  }

  _handleOnSwiped(ev, x, y, isFlick) {
    this.setState({isFlick: isFlick});
  }

  _shouldSlideOnSwipe() {
    const shouldSlide = Math.abs(this.state.offsetPercentage) > 30 ||
      this.state.isFlick;

    if (shouldSlide) {
      // reset isFlick state after so data is not persisted
      this.setState({isFlick: false});
    }
    return shouldSlide;
  }

  _handleOnSwipedTo(index) {
    let slideTo = this.state.currentIndex;

    if (this._shouldSlideOnSwipe()) {
      slideTo += index;
    }

    if (index < 0) {
      if (!this._canSlideLeft()) {
        slideTo = this.state.currentIndex;
      }
    } else {
      if (!this._canSlideRight()) {
        slideTo = this.state.currentIndex;
      }
    }

    this._unthrottledSlideToIndex(slideTo);
  }

  _handleSwiping(index, _, delta) {
    let offsetPercentage = index * (delta / this.state.galleryWidth * 100);
    if (Math.abs(offsetPercentage) >= 100) {
      offsetPercentage = index * 100;
    }
    this.setState({
      offsetPercentage: offsetPercentage,
      style: {}
    });
  }

  _canNavigate() {
    return this.props.items.length >= 2;
  }

  _canSlideLeft() {
    return this.props.infinite || this.state.currentIndex > 0;
  }

  _canSlideRight() {
    return this.props.infinite ||
      this.state.currentIndex < this.props.items.length - 1;
  }

  _updateThumbnailTranslate(prevState) {
    if (this.state.currentIndex === 0) {
      this._setThumbsTranslate(0);
    } else {
      const oldIndexColumn = this._getImageColumnByIndex(this.props.items, prevState.currentIndex);
      const newIndexColumn = this._getImageColumnByIndex(this.props.items, this.state.currentIndex);

      const indexDifference = this.state.isMultilineLayoutActive ?
        Math.abs(oldIndexColumn - newIndexColumn) :
        Math.abs(prevState.currentIndex - this.state.currentIndex);

      const maxRowSize = this.state.isMultilineLayoutActive ?
        Math.ceil(this.props.items.length / 2) : this.props.items.length;

      const direction = this.state.isMultilineLayoutActive ?
        oldIndexColumn < newIndexColumn ? "forward" : oldIndexColumn > newIndexColumn ? "backward" : "none" :
        prevState.currentIndex < this.state.currentIndex ? "forward" : prevState.currentIndex > this.state.currentIndex ? "backward" : "none";

      const scroll = this._getThumbsTranslate(maxRowSize, indexDifference);

      if (scroll > 0) {
        if (direction === "forward") {
          this._setThumbsTranslate(
            this.state.thumbsTranslate - scroll);
        } else if (direction === "backward") {
          this._setThumbsTranslate(
            this.state.thumbsTranslate + scroll);
        }
      }
    }
  }

  _setThumbsTranslate(thumbsTranslate) {
    this.setState({thumbsTranslate});
  }

  _getImageColumnByIndex(items, index) {
    const firstRowCount = Math.ceil(items.length / 2);
    return index < firstRowCount ? index : index - firstRowCount;
  }

  _getThumbsTranslate(itemsPerRow, indexDifference) {
    if (this.props.disableThumbnailScroll) {
      return 0;
    }

    const totalScroll = this._getThumbnailsTotalScrollSize();

    if (this._thumbnails) {
      const totalThumbnails = itemsPerRow;
      // scroll-x required per index change
      const perIndexScroll = totalScroll / (totalThumbnails - 1);

      return indexDifference * perIndexScroll;
    }
  }

  _getThumbsVisibleRange() {
    const {currentIndex, thumbsTranslate} = this.state;

    if (this._thumbnails) {
      // check that thumbnailsWrapper is not an empty
      if ((this._isThumbnailHorizontal() && this.state.thumbnailsWrapperHeight === 0) ||
          (!this._isThumbnailHorizontal() && this.state.thumbnailsWrapperWidth === 0)) {
        return {
          min: 0,
          max: 0
        };
      }

      const totalScroll = this._getThumbnailsTotalScrollSize();
      const totalThumbnails = this.props.items.length;
      // if all thumbnails are visible
      if (this.state.isMultilineLayoutActive || totalScroll === 0) {
        return {
          min: 0,
          max: totalThumbnails - 1
        };
      }

      // we need to multiply the count of required thumbnails by 2
      // because a user can click on last visible thumbnail for the current state
      // and we don't want to show a lot of default pictures in this case
      const perIndexScroll = totalScroll / (totalThumbnails - 1);
      const loadThumbnailsCount =
        (Math.round(this.state.thumbnailsWrapperWidth / perIndexScroll) - 2) * 2;

      const offsetBefore = Math.abs(thumbsTranslate * 100 / totalScroll);
      const offsetAfter = 100 - offsetBefore;
      const bufferBefore = this.props.infinite && currentIndex === 0 ? loadThumbnailsCount / 2 : 0;
      const bufferAfter = this.props.infinite && (currentIndex === totalThumbnails - 1) ? loadThumbnailsCount / 2 : 0;
      const thumbnailsBefore = Math.ceil(bufferBefore + offsetBefore * loadThumbnailsCount / 100);
      const thumbnailsAfter = Math.ceil(bufferAfter + offsetAfter * loadThumbnailsCount / 100);

      if (thumbnailsBefore + thumbnailsAfter + 1 >= totalThumbnails) {
        return {
          min: 0,
          max: totalThumbnails - 1
        };
      }

      let minRangeValue = currentIndex - thumbnailsBefore;
      // adjust the lower boundary of the range of images to load
      minRangeValue = minRangeValue < 0
        ? (this.props.infinite ? (totalThumbnails - 1) + minRangeValue : 0)
        : minRangeValue;

      let maxRangeValue = currentIndex + thumbnailsAfter;
      // adjust the upper boundary of the range of images to load
      maxRangeValue = maxRangeValue > (totalThumbnails - 1)
        ? (this.props.infinite
          ? maxRangeValue - (totalThumbnails - 1)
          : (totalThumbnails - 1))
        : maxRangeValue;

      // we will load only part of thumbnails, lazyload works in this case
      return {
        min: minRangeValue,
        max: maxRangeValue
      };
    }

    return {
      min: 0,
      max: 0
    };
  }

  _getThumbnailsTotalScrollSize() {
    if (this._thumbnails) {
      // total scroll required to see the last thumbnail
      if (this._isThumbnailHorizontal()) {
        if (this._thumbnails.scrollHeight <= this._thumbnailsWrapper.offsetHeight) {
          return 0;
        }
        return this._thumbnails.scrollHeight - this._thumbnailsWrapper.offsetHeight;
      } else {
        if (this._thumbnails.scrollWidth <= this._thumbnailsWrapper.offsetWidth) {
          return 0;
        }
        return this._thumbnails.scrollWidth - this._thumbnailsWrapper.offsetWidth;
      }
    }
    return 0;
  }

  _getAlignmentClassName(index) {
    // LEFT, and RIGHT alignments are necessary for lazyLoad
    let {currentIndex} = this.state;
    let alignment = '';
    const LEFT = 'left';
    const CENTER = 'center';
    const RIGHT = 'right';

    switch (index) {
      case (currentIndex - 1):
        alignment = ` ${LEFT}`;
        break;
      case (currentIndex):
        alignment = ` ${CENTER}`;
        break;
      case (currentIndex + 1):
        alignment = ` ${RIGHT}`;
        break;
    }

    if (this.props.items.length >= 3 && this.props.infinite) {
      if (index === 0 && currentIndex === this.props.items.length - 1) {
        // set first slide as right slide if were sliding right from last slide
        alignment = ` ${RIGHT}`;
      } else if (index === this.props.items.length - 1 && currentIndex === 0) {
        // set last slide as left slide if were sliding left from first slide
        alignment = ` ${LEFT}`;
      }
    }

    return alignment;
  }

  _getTranslateXForTwoSlide(index) {
    // For taking care of infinite swipe when there are only two slides
    const {currentIndex, offsetPercentage, previousIndex} = this.state;
    const baseTranslateX = -100 * currentIndex;
    let translateX = baseTranslateX + (index * 100) + offsetPercentage;

    // keep track of user swiping direction
    if (offsetPercentage > 0) {
      this.direction = 'left';
    } else if (offsetPercentage < 0) {
      this.direction = 'right';
    }

    // when swiping make sure the slides are on the correct side
    if (currentIndex === 0 && index === 1 && offsetPercentage > 0) {
      translateX = -100 + offsetPercentage;
    } else if (currentIndex === 1 && index === 0 && offsetPercentage < 0) {
      translateX = 100 + offsetPercentage;
    }

    if (currentIndex !== previousIndex) {
      // when swiped move the slide to the correct side
      if (previousIndex === 0 && index === 0 &&
          offsetPercentage === 0 && this.direction === 'left') {
        translateX = 100;
      } else if (previousIndex === 1 && index === 1 &&
          offsetPercentage === 0 && this.direction === 'right') {
        translateX = -100;
      }
    } else {
      // keep the slide on the correct slide even when not a swipe
      if (currentIndex === 0 && index === 1 &&
          offsetPercentage === 0 && this.direction === 'left') {
        translateX = -100;
      } else if (currentIndex === 1 && index === 0 &&
          offsetPercentage === 0 && this.direction === 'right') {
        translateX = 100;
      }
    }

    return translateX;
  }

  _getThumbnailBarHeight() {
    if (this._isThumbnailHorizontal()) {
      return {
        height: this.state.gallerySlideWrapperHeight
      };
    }
    return {};
  }

  _getSlideStyle(index) {
    const {currentIndex, offsetPercentage} = this.state;
    const {infinite, items} = this.props;
    const baseTranslateX = -100 * currentIndex;
    const totalSlides = items.length - 1;

    // calculates where the other slides belong based on currentIndex
    let translateX = baseTranslateX + (index * 100) + offsetPercentage;

    // adjust zIndex so that only the current slide and the slide were going
    // to is at the top layer, this prevents transitions from flying in the
    // background when swiping before the first slide or beyond the last slide
    let zIndex = 1;
    if (index === currentIndex) {
      zIndex = 3;
    } else if (index === this.state.previousIndex) {
      zIndex = 2;
    } else if (index === 0 || index === totalSlides) {
      zIndex = 0;
    }

    if (infinite && items.length > 2) {
      if (currentIndex === 0 && index === totalSlides) {
        // make the last slide the slide before the first
        translateX = -100 + offsetPercentage;
      } else if (currentIndex === totalSlides && index === 0) {
        // make the first slide the slide after the last
        translateX = 100 + offsetPercentage;
      }
    }

    // Special case when there are only 2 items with infinite on
    if (infinite && items.length === 2) {
      translateX = this._getTranslateXForTwoSlide(index);
    }

    const translate3d = `translate3d(${translateX}%, 0, 0)`;

    return {
      WebkitTransform: translate3d,
      MozTransform: translate3d,
      msTransform: translate3d,
      OTransform: translate3d,
      transform: translate3d,
      zIndex: zIndex
    };
  }

  _getThumbnailStyle() {
    let translate3d;

    if (this._isThumbnailHorizontal()) {
      translate3d = `translate3d(0, ${this.state.thumbsTranslate}px, 0)`;
    } else {
      translate3d = `translate3d(${this.state.thumbsTranslate}px, 0, 0)`;
    }
    return {
      WebkitTransform: translate3d,
      MozTransform: translate3d,
      msTransform: translate3d,
      OTransform: translate3d,
      transform: translate3d
    };
  }

  _slideLeft(event) {
    this.slideToIndex(this.state.currentIndex - 1, event);
  }

  _slideRight(event) {
    this.slideToIndex(this.state.currentIndex + 1, event);
  }

  _onImageLoad(index, event) {
    // when lazyload is enabled, we need to know
    // that the image was successfully loaded (to avoid content jumping).
    if (this.props.lazyLoad) {
      const { currentIndex } = this.state;
      this._itemsLazyLoadedSuccessfully.push(this.props.items[index].original);
      if (currentIndex === index) {
        // save the size of active image, it's equal to the gallerySlideWrapper size
        this.setState({
          gallerySlideWrapperWidth: event.target.offsetWidth,
          gallerySlideWrapperHeight: event.target.offsetHeight
        });
      }
    }
    if (this.props.onImageLoad != null) {
      this.props.onImageLoad(event);
    }
  }

  _renderItem(item, onLoad) {
    const onImageError = this.props.onImageError || this._handleImageError;

    return (
      <div className='image-gallery-image'>
        <img
            src={item.original}
            alt={item.originalAlt}
            srcSet={item.srcSet}
            sizes={item.sizes}
            onLoad={onLoad}
            onError={onImageError.bind(this)}
        />
        {
          item.description &&
            <span className='image-gallery-description'>
              {item.description}
            </span>
        }
      </div>
    );
  }

  onFeaturedItemLoad = () => {
    if (this._thumbnailsWrapper) {
      if (this._isThumbnailHorizontal()) {
        this.setState({thumbnailsWrapperHeight: this._thumbnailsWrapper.offsetHeight});
      } else {
        this.setState({thumbnailsWrapperWidth: this._thumbnailsWrapper.offsetWidth});
      }
    }
  }

  render() {
    const {
      currentIndex,
      isFullscreen,
      modalFullscreen,
      isPlaying
    } = this.state;
    const {
      featuredItem
    } = this.props;

    const thumbnailStyle = this._getThumbnailStyle();
    const thumbnailPosition = this.props.thumbnailPosition;

    const slideLeft = this._slideLeft.bind(this);
    const slideRight = this._slideRight.bind(this);

    let slides = [];
    let thumbnails = [];
    let bullets = [];

    const thumbnailsVisibleRange = this._getThumbsVisibleRange();

    this.props.items.map((item, index) => {
      const alignment = this._getAlignmentClassName(index);
      const originalClass = item.originalClass ?
        ` ${item.originalClass}` : '';
      const thumbnailClass = item.thumbnailClass ?
        ` ${item.thumbnailClass}` : '';

      const renderItem = item.renderItem ||
        this.props.renderItem || this._renderItem.bind(this);

      const showItem = !this.props.lazyLoad || alignment || this._lazyLoaded[index];
      if (showItem && this.props.lazyLoad) {
        this._lazyLoaded[index] = true;
      }

      // If lazyload is enabled and an image was not loaded,
      // we set the size of the container is equal to the size of the last active element
      // to avoid content jumping.
      const imageSize = this.props.lazyLoad && !this._itemsLazyLoadedSuccessfully.includes(item.original)
        ? {
            width: this.state.gallerySlideWrapperWidth,
            height: this.state.gallerySlideWrapperHeight
          }
        : {};

      const slide = (
        <div
          key={index}
          className={'image-gallery-slide' + alignment + originalClass}
          style={Object.assign(this._getSlideStyle(index), this.state.style, imageSize)}
          onClick={this.props.onClick}
        >
          {showItem ? renderItem(item, this._onImageLoad.bind(this, index)) : <div style={{ height: '100%' }}></div>}
        </div>
      );

      slides.push(slide);

      let onThumbnailError = this._handleImageError;
      if (this.props.onThumbnailError) {
        onThumbnailError = this.props.onThumbnailError;
      }

      if (this.props.showThumbnails) {
        const showThumbnail = !this.props.lazyLoad ||
          this._lazyLoadedThumbnails[index] ||
          // infinite scroll is disabled
          (index >= thumbnailsVisibleRange.min && index <= thumbnailsVisibleRange.max) ||
          // infinite scroll is enabled, e.g. min = 34, max = 16
          (thumbnailsVisibleRange.min > thumbnailsVisibleRange.max &&
            ((index >= thumbnailsVisibleRange.min && index <= this.props.items.length) ||
            (index >= 0 && index <= thumbnailsVisibleRange.max)));

        if (showThumbnail && this.props.lazyLoad) {
          this._lazyLoadedThumbnails[index] = true;
        }

        thumbnails.push(
          <a
            onMouseOver={this._handleMouseOverThumbnails.bind(this, index)}
            onMouseLeave={this._handleMouseLeaveThumbnails.bind(this, index)}
            key={index}
            role='button'
            aria-pressed={currentIndex === index ? 'true' : 'false'}
            aria-label={`Go to Slide ${index + 1}`}
            className={
              'image-gallery-thumbnail' +
              (currentIndex === index ? ' active' : '') +
              thumbnailClass
            }

            onClick={event => this.slideToIndex.call(this, index, event)}>
              <img
                src={showThumbnail ? item.thumbnail : ""}
                alt={item.thumbnailAlt}
                onError={onThumbnailError.bind(this)}/>
              <div className='image-gallery-thumbnail-label'>
                {item.thumbnailLabel}
              </div>
          </a>
        );
      }

      if (this.props.showBullets) {
        bullets.push(
          <button
            key={index}
            type='button'
            className={
              'image-gallery-bullet ' + (
                currentIndex === index ? 'active' : '')}

            onClick={event => this.slideToIndex.call(this, index, event)}
            aria-pressed={currentIndex === index ? 'true' : 'false'}
            aria-label={`Go to Slide ${index + 1}`}
          >
          </button>
        );
      }
    });

    const slideWrapper = (
      <div
        ref={i => this._imageGallerySlideWrapper = i}
        className={`image-gallery-slide-wrapper ${thumbnailPosition}`}
      >

        {this.props.renderCustomControls && this.props.renderCustomControls()}

        {
          this.props.showFullscreenButton &&
            this.props.renderFullscreenButton(this._toggleFullScreen.bind(this), isFullscreen)
        }

        {
          this.props.showPlayButton &&
            this.props.renderPlayPauseButton(this._togglePlay.bind(this), isPlaying)
        }

        {
          this._canNavigate() ?
            [
              this.props.showNav &&
                <span key='navigation'>
                  {this.props.renderLeftNav(slideLeft, !this._canSlideLeft())}
                  {this.props.renderRightNav(slideRight, !this._canSlideRight())}
                </span>,

                this.props.disableSwipe ?
                  <div className='image-gallery-slides' key='slides'>
                    {slides}
                  </div>
                :
                  <Swipeable
                    className='image-gallery-swipe'
                    key='swipeable'
                    delta={1}
                    onSwipingLeft={this._handleSwiping.bind(this, -1)}
                    onSwipingRight={this._handleSwiping.bind(this, 1)}
                    onSwiped={this._handleOnSwiped.bind(this)}
                    onSwipedLeft={this._handleOnSwipedTo.bind(this, 1)}
                    onSwipedRight={this._handleOnSwipedTo.bind(this, -1)}
                  >
                    <div className='image-gallery-slides'>
                      {slides}
                    </div>
                </Swipeable>
            ]
          :
            <div className='image-gallery-slides'>
              {slides}
            </div>
        }
        {
          this.props.showBullets &&
            <div className='image-gallery-bullets'>
              <ul
                className='image-gallery-bullets-container'
                role='navigation'
                aria-label='Bullet Navigation'
              >
                {bullets}
              </ul>
            </div>
        }
        {
          this.props.showIndex &&
            <div className='image-gallery-index'>
              <span className='image-gallery-index-current'>
                {this.state.currentIndex + 1}
              </span>
              <span className='image-gallery-index-separator'>
                {this.props.indexSeparator}
              </span>
              <span className='image-gallery-index-total'>
                {this.props.items.length}
              </span>
            </div>
        }
      </div>
    );

    let onThumbnailError = this._handleImageError;
    if (this.props.onThumbnailError) {
      onThumbnailError = this.props.onThumbnailError;
    }

    let justifyContent = "center";
    if (this.state.isFeaturedItemActive) {
      justifyContent = "space-between";
    }

    let thumbnailsComponent = null;
    let wrapperType = "";
    let wrapperStyle = {};
    if (this.state.isMultilineLayoutActive) {
      wrapperType = "multi-line";
      thumbnailsComponent = (
        <div>
          <div>{thumbnails.slice(0, Math.ceil(thumbnails.length / 2))}</div>
          <div>{thumbnails.slice(Math.ceil(thumbnails.length / 2))}</div>
        </div>
      );
      wrapperStyle = Object.assign(
        {},
        this._getThumbnailBarHeight(),
        {
          display: "flex",
          alignItems: "flex-start",
          justifyContent: justifyContent
        }
      );
    } else {
      thumbnailsComponent = thumbnails;
      wrapperType = "single-line";
      wrapperStyle = Object.assign(
        {},
        this._getThumbnailBarHeight(),
        featuredItem != null ? {
          display: "flex",
          justifyContent: "space-between"
        } : {
          textAlign: "center"
        }
      );
    }

    return (
      <section
        ref={i => this._imageGallery = i}
        id='image-gallery'
        className={
          `image-gallery${modalFullscreen ? ' fullscreen-modal' : ''}`}
        aria-live='polite'
      >

        <div
          className={`image-gallery-content${isFullscreen ? ' fullscreen' : ''}`}
        >

          {
            (thumbnailPosition === 'bottom' || thumbnailPosition === 'right') &&
              slideWrapper
          }
          {
            this.props.showThumbnails &&
              <div
                className={`image-gallery-thumbnails-wrapper image-gallery-thumbnails-wrapper__${wrapperType} ${thumbnailPosition}`}
                style={wrapperStyle}
              >
                <div
                  className='image-gallery-thumbnails'
                  ref={i => this._thumbnailsWrapper = i}
                >
                  <div
                    ref={t => this._thumbnails = t}
                    className='image-gallery-thumbnails-container'
                    style={thumbnailStyle}
                    role='navigation'
                    aria-label='Thumbnail Navigation'
                  >
                    {thumbnailsComponent}
                  </div>
                </div>
                <div
                  className='image-gallery-featured-thumbnails'
                  style={{height: this._thumbnailsWrapper != null ? this._thumbnailsWrapper.offsetHeight + "px" : "auto"}}
                >
                  {
                    this.state.isFeaturedItemActive ?
                      <FeaturedVideoThumbnail
                        item={this.props.featuredItem}
                        onClick={this.exitFullScreen}
                        onError={onThumbnailError.bind(this)}
                        onLoad={this.onFeaturedItemLoad}
                      /> : null
                  }
                </div>
              </div>
          }
          {
            (thumbnailPosition === 'top' || thumbnailPosition === 'left') &&
              slideWrapper
          }

        </div>

      </section>
    );
  }

}


class FeaturedVideoThumbnail extends React.Component {

  defaultRender = (item, onClick, onError, onLoad) => {
    const { thumbnailClass, thumbnail, thumbnailAlt, thumbnailLabel } = item;
    const featuredThumbnailClass = thumbnailClass ?
      ` ${thumbnailClass}` : '';

    return (
      <a
        role='button'
        aria-label={`Featured Item`}
        className={
          'image-gallery-featured-thumbnail' +
          featuredThumbnailClass
        }
        onClick={onClick}>
          <img
            src={thumbnail}
            alt={thumbnailAlt}
            onError={onError}
            onLoad={onLoad}
          />
          <div className='image-gallery-thumbnail-label'>
            {thumbnailLabel}
          </div>
      </a>
    );
  }

  render() {
    const { item, onClick, onError, onLoad } = this.props;
    const renderThumbInner = item.renderThumbInner || this.defaultRender;
    const thumbnail = renderThumbInner(item, onClick, onError, onLoad);

    return thumbnail;
  }
}
