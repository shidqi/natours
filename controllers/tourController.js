const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const Tour = require('./../models/tourModel');
const catchAsync = require('./../utils/catchasync');
const handlerFactory = require('./handlerFactory');
const AppError = require('./../utils/apperror');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // File format
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(
      new AppError('Not an image! please upload only image format', 400),
      false
    );
  }
};

// Config
const uploadConfig = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5000000
  }
});

exports.updateImages = uploadConfig.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 8 }
]);

exports.resizeImages = (req, res, next) => {
  if (!req.files) return next();

  // 1) Image Cover
  req.body.imageCover = `user-${req.params.id}-${Date.now()}.jpeg`;

  sharp(req.files.imageCover[0].buffer)
    .resize(1080, 720)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2) Images
  req.body.images = [];
  let fileNameImages = null;

  for (let i = 0; i < req.files.images.length; i++) {
    fileNameImages = `user-${req.params.id}-${Date.now() + i}.jpeg`;
    req.body.images.push(fileNameImages);

    sharp(req.files.images[i].buffer)
      .resize(1080, 720)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toFile(`public/img/tours/${fileNameImages}`);
  }

  return next();
};

exports.deleteFiles = (req, res, next) => {
  // delete old image when update the photo
  if (req.file) {
    fs.unlink(
      path.join(__dirname, '..', 'public', 'img', 'users', `${req.user.photo}`),
      err => {
        if (err) return next(new AppError('Something went wrong', 400));
      }
    );
    return next();
  }

  return next();
};

exports.getTopTours = (req, res, next) => {
  req.query.limit = 5;
  req.query.sort = 'price,ratingsAverage';
  req.query.fields = 'name,price,ratingsAverage, summary, difficulty';
  next();
};

exports.getAllTours = handlerFactory.getAll(Tour);

exports.getTour = handlerFactory.getOne(Tour, {
  path: 'reviews',
  select: 'rating review -tour user'
});

exports.updateTour = handlerFactory.updateOne(Tour);

exports.deleteTour = handlerFactory.deleteOne(Tour);

// exports.deleteTour = catchAsync(async (req, res, next) => {
//   await Tour.findByIdAndDelete(req.params.id);

//   return res.status(200).json({
//     status: 'success',
//     message: 'Data has been successfully deleted.'
//   });
// });

exports.createTour = handlerFactory.createOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $group: {
        _id: { $toUpper: '$difficulty' },
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' }
      }
    }
  ]);

  return res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = Number(req.params.year);

  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates'
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`)
        }
      }
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        amount: { $sum: 1 },
        name: { $push: '$name' }
      }
    },
    {
      $addFields: {
        month: '$_id'
      }
    },
    {
      $sort: {
        month: 1
      }
    },
    {
      $project: {
        _id: 0
      }
    },
    {
      $limit: 12
    }
  ]);

  return res.status(200).json({
    status: 'success',
    data: {
      plan
    }
  });
});

// route('/tours-within/:distance/center/:latlng/unit/:unit')
// /tours-within/250/center/34.082669, -118.281201/unit/mi

exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng)
    return next(new AppError(`Please provide latitude & longitude`, 400));

  const tour = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } }
  });

  res.status(200).json({
    status: 'success',
    results: tour.length,
    data: tour
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.0001;

  if (!lat || !lng)
    return next(new AppError(`Please provide latitude & longitude`, 400));

  const tour = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [Number(lng), Number(lat)]
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier
      }
    },
    {
      $project: {
        name: 1,
        distance: 1
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    results: tour.length,
    data: tour
  });
});
