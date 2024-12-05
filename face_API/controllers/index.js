require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const knex = require("knex");
const configOptions = require("../knexfile");
const db = knex(configOptions);

// **Note: Copy from the Google vision api document:
// https://cloud.google.com/vision/docs/base64?hl=en#using_client_libraries
function encodeImage(image) {
  // get the path of the image you want to access
  const imageFilePath = path.resolve(__dirname, `../public/images/${image}`);

  // read the image data
  const imageFile = fs.readFileSync(imageFilePath);

  // Convert the image data to a Buffer and encode it to base64 format.
  const base64ImageStr = Buffer.from(imageFile).toString("base64");
  return base64ImageStr;
}

const listImageController = async (req, res) => {
  // TODO: add you code here
  try {
    const images = await db("image").select("*"); // Fetch all images from the database
    res.json(images);
  } catch (error) {
    res.status(500).send(`Error fetching images: ${error}`);
  }
};

const getImageController = async (req, res) => {
  // TODO: add you code here
  const { id } = req.params; // Extract ID from request parameters
  try {
    const image = await db("image").where({ id }).first(); // Fetch image by ID
    if (!image) {
      return res.status(404).send("Image not found");
    }
    res.json(image);
  } catch (error) {
    res.status(500).send(`Error fetching image: ${error}`);
  }
};

const createImageController = async (req, res) => {
  try {
    // Google Vision API key is stored in env file
    const apiKey = process.env.API_KEY;

    // req.file exist after upload.single("imageFile") middleware is resolved
    const imageFileName = req.file.originalname;
    const base64ImageStr = encodeImage(imageFileName);

    // **Note: check out the document to see how to configure the request body of the google vision PAI
    // https://cloud.google.com/vision/docs/reference/rest/v1/AnnotateImageRequest
    request_body = {
      requests: [
        {
          image: {
            content: base64ImageStr, // this need to be base64 string
          },
          features: [
            {
              type: "FACE_DETECTION",
              maxResults: 50
            },
          ],
        },
      ],
    };

    // TODO: add you code here
    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      request_body
    );
    //console.log(response.data.responses[0].labelAnnotations[0].description)
    // Store the image info in the database
    const result = response.data
    const face_annotations = result["responses"][0]["faceAnnotations"]

    if (!face_annotations) {
      console.log(result["responses"]);
      throw new Error("face_annotations does not exist");
    }

    const faces = [];
    for (const face of face_annotations) {
      let face_expression = {};
      face_expression["joyLikelihood"] = face["joyLikelihood"];
      face_expression["sorrowLikelihood"] = face["sorrowLikelihood"];
      face_expression["angerLikelihood"] = face["angerLikelihood"];
      face_expression["surpriseLikelihood"] = face["surpriseLikelihood"];
      face_expression["underExposedLikelihood"] =
        face["underExposedLikelihood"];
      face_expression["blurredLikelihood"] = face["blurredLikelihood"];
      face_expression["headwearLikelihood"] = face["headwearLikelihood"];
      faces.push(face_expression);
    }

    const newImage = await db("image")
    .insert({
      name: imageFileName,
      face_detected: JSON.stringify(faces),
    })
    .then((item) => {
      return item.rowCount;
    });

  if (newImage === 1) {
    return res.status(201).json({ message: "Image created successfully" });
  }
} catch (error) {
  res.status(500).send(`Error occurs. Error: ${error}`);
}
};

module.exports = {
  listImageController,
  getImageController,
  createImageController,
};
