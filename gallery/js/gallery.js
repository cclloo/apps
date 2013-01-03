var Gallery = {};
Gallery.albums = {};
Gallery.currentAlbum = '';
Gallery.subAlbums = {};

Gallery.sortFunction = function (a, b) {
	return a.toLowerCase().localeCompare(b.toLowerCase());
};

// fill the albums from Gallery.images
Gallery.fillAlbums = function () {
	var albumPath, i, imagePath, parent;
	for (i = 0; i < Gallery.images.length; i++) {
		imagePath = Gallery.images[i];
		albumPath = OC.dirname(imagePath);
		if (!Gallery.albums[albumPath]) {
			Gallery.albums[albumPath] = [];
		}
		parent = OC.dirname(albumPath);
		while (parent && !Gallery.albums[parent]) {
			Gallery.albums[parent] = [];
			parent = OC.dirname(parent);
		}
		Gallery.albums[albumPath].push(imagePath);
	}
	Gallery.albums[albumPath].sort(Gallery.sortFunction);

	for (albumPath in Gallery.albums) {
		if (albumPath !== '') {
			parent = OC.dirname(albumPath);
			if (!Gallery.subAlbums[parent]) {
				Gallery.subAlbums[parent] = [];
			}
			Gallery.subAlbums[parent].push(albumPath);
		}
	}

	for (path in Gallery.subAlbums) {
		Gallery.subAlbums[path].sort(Gallery.sortFunction);
	}
};
Gallery.getImage = function (image) {
	return OC.filePath('files', 'ajax', 'download.php') + '?dir=' + encodeURIComponent(OC.dirname(image)) + '&files=' + encodeURIComponent(OC.basename(image));
};
Gallery.getThumbnail = function (image) {
	return OC.filePath('gallery', 'ajax', 'thumbnail.php') + '?file=' + encodeURIComponent(image);
};
Gallery.getAlbumThumbnail = function (image) {
	return OC.filePath('gallery', 'ajax', 'albumthumbnail.php') + '?file=' + encodeURIComponent(image);
};
Gallery.view = {};
Gallery.view.element = null;
Gallery.view.clear = function () {
	Gallery.view.element.empty();
};
Gallery.view.cache = {};

Gallery.view.addImage = function (image) {
	var link , thumb;
	if (Gallery.view.cache[image]) {
		Gallery.view.element.append(Gallery.view.cache[image]);
	} else {
		link = $('<a/>');
		thumb = $('<img/>');
		link.addClass('image');
		link.attr('href', Gallery.getImage(image)).attr('rel', 'album').attr('alt', OC.basename(image)).attr('title', OC.basename(image));

		thumb.attr('src', Gallery.getThumbnail(image));
		link.append(thumb);

		Gallery.view.element.append(link);
		Gallery.view.cache[image] = link;
	}
};

Gallery.view.addAlbum = function (path) {
	var link, image, label;
	if (Gallery.view.cache[path]) {
		Gallery.view.element.append(Gallery.view.cache[path]);
		//event handlers are removed when using clear()
		Gallery.view.cache[path].click(Gallery.view.viewAlbum.bind(null, path));
		Gallery.view.cache[path].mousemove(Gallery.view.addAlbum.mouseEvent.bind(Gallery.view.cache[path], Gallery.view.addAlbum.thumbs[path]));
	} else {
		link = $('<a/>');
		label = $('<label/>');
		link.attr('href', '#' + path);
		link.addClass('album');
		link.click(Gallery.view.viewAlbum.bind(null, path));
		link.data('path', path);
		link.data('offset', 0);
		link.attr('style', 'background-image:url("' + Gallery.getAlbumThumbnail(path) + '")').attr('title', OC.basename(path));
		label.text(OC.basename(path));
		link.append(label);
		image = new Image();
		image.src = Gallery.getAlbumThumbnail(path);
		Gallery.view.addAlbum.thumbs[path] = image;

		link.mousemove(Gallery.view.addAlbum.mouseEvent.bind(link, image));

		Gallery.view.element.append(link);
		Gallery.view.cache[path] = link;
	}
};
Gallery.view.addAlbum.mouseEvent = function (image, event) {
	var mousePos = event.pageX - $(this).offset().left,
		path = $(this).data('path'),
		album = Gallery.albums[path],
		offset = Math.floor((mousePos / 200) * (image.width / 200)),
		oldOffset = $(this).data('offset');
	if (offset !== oldOffset) {
		$(this).css('background-position', offset * 200 + 'px 0px');
		$(this).data('offset', offset);
	}
};
Gallery.view.addAlbum.thumbs = {};

Gallery.view.viewAlbum = function (albumPath) {
	Gallery.view.clear();
	Gallery.currentAlbum = albumPath;

	var i, album, subAlbums, crumbs, path;
	subAlbums = Gallery.subAlbums[albumPath];
	if (subAlbums) {
		for (i = 0; i < subAlbums.length; i++) {
			Gallery.view.addAlbum(subAlbums[i]);
			Gallery.view.element.append(' '); //add a space for justify
		}
	}

	album = Gallery.albums[albumPath];
	for (i = 0; i < album.length; i++) {
		Gallery.view.addImage(album[i]);
		Gallery.view.element.append(' '); //add a space for justify
	}

	OC.Breadcrumb.clear();
	OC.Breadcrumb.push('Pictures', '#').click(Gallery.view.viewAlbum.bind(null, ''));
	crumbs = albumPath.split('/');
	path = '';
	for (i = 0; i < crumbs.length; i++) {
		if (crumbs[i]) {
			path += '/' + crumbs[i];
			OC.Breadcrumb.push(crumbs[i], '#' + crumbs[i]).click(Gallery.view.viewAlbum.bind(null, path));
		}
	}

	$('#gallery').children('a.image').fancybox({
		"titlePosition": "inside"
	});
};

Gallery.slideshow = {
	supersized: {},
	init: function () {
		$('#slideshow-content').append("<div id='supersized-holder'></div>");
		$('#supersized-loader').remove();
		$('#supersized').remove();
		$('#supersized-holder').append("<div id='supersized-loader'></div><ul id='supersized'></ul>");
	},
	start: function () {
		var i,
			album = Gallery.albums[Gallery.currentAlbum],
			images = [];

		for (i = 0; i < album.length; i++) {
			images.push({image: Gallery.getImage(album[i]), title: OC.basename(album[i]), thumb: Gallery.getThumbnail(album[i]), url: 'javascript:Gallery.slideshow.end()'});
		}

		if (images.length <= 0) {
			return;
		}

		//ensure all cleanup is done
		Gallery.slideshow.end();
		if ($.supersized.vars.is_paused && Gallery.slideshow.supersized.playToggle) {
			Gallery.slideshow.supersized.playToggle();
		}

		Gallery.slideshow.init();
		$('#supersized').show();
		$('#slideshow-content').show();

		$.supersized.themeVars.image_path = OC.linkTo('gallery', 'img/supersized/');
		$.supersized.call(Gallery.slideshow.supersized, {

			// Functionality
			slide_interval: 3000, // Length between transitions
			transition: 1, // 0-None, 1-Fade, 2-Slide Top, 3-Slide Right, 4-Slide Bottom, 5-Slide Left, 6-Carousel Right, 7-Carousel Left
			transition_speed: 700, // Speed of transition

			// Components
			slide_links: 'blank', // Individual links for each slide (Options: false, 'num', 'name', 'blank')
			slides: images, // Slideshow Images
			image_protect: false,
			fit_always: true

		});

		if (BigScreen.enabled) {
			BigScreen.request();
		}

		$('html').css('overflow', 'hidden');//hide scrollbar during the slideshow
	},
	end: function () {
		BigScreen.exit();
		if (!$.supersized.vars.is_paused && Gallery.slideshow.supersized.playToggle) {
			Gallery.slideshow.supersized.playToggle();
		}
		if ($.supersized.vars.slideshow_interval) {
			clearInterval($.supersized.vars.slideshow_interval);
		}

		$('#supersized-holder').remove();
		$('#slideshow-content').hide();
		$('#thumb-list').remove();
		Gallery.slideshow.supersized = {};
		$.supersized.vars.in_animation = false;
		$.supersized.vars.current_slide = 0;
		$('html').css('overflow', 'auto');
	}
};

$(document).ready(function () {
	Gallery.fillAlbums();
	Gallery.view.element = $('#gallery');
	OC.Breadcrumb.container = $('#breadcrumbs');
	var album = location.hash.substr(1);
	Gallery.view.viewAlbum(album);

	//close slideshow on esc and remove holder
	$(document).keyup(function (e) {
		if (e.keyCode === 27) { // esc
			Gallery.slideshow.end();
		}
	});
	$('#slideshow-start').click(function () {
		Gallery.slideshow.start();
	});
});
