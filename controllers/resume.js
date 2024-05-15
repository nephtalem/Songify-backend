import Resume from "../models/Resume.js";
import User from "../models/User.js";
import OpenAI from 'openai'
import { customMail } from "./mailer.js";

export const updateResume = async (req, res, next) => {
  const { dataUpdate } = req.body;
  const id = req.params.id;
  try {
    const d = await Resume.findById(id);
    if (d?.user === req.user.userId) {
      Resume.findOneAndUpdate({ _id: id }, dataUpdate).then(
        (updatedDocument) => {
          res.status(200).json({ status: "Success", data:updatedDocument });
        }
      ).catch((err)=>{
        res.status(200).json({ status: "Error", data: err });
    })

    } else {
      res.status(200).json({ status: "Error", data: "Not authorized" });
    }
  } catch (err) {
    next(err);
  }
};

export const AIupdateResume = async (req, res, next) => {
  const openai = new OpenAI();
  const { description,userId } = req.body;


  // const description = undefined
  const messages = [
    {
        "role": "system",
        "content": `You are a resume maker. You will be given a job requerment details,
         you should be able to take the key words and give 10 skills in the form 
         Skills: skill number one, skill number 2 separated by comma. Don't take the works literally, 
         instead change as people write in there resumes. Mkake the skills specific,
          example programming languages. remember each skill sould not have more than three words `,
    }
];
messages.push({
  "role": "user",
  "content": `Job description: ${description}`,
});
let didAnswer=true
let skills
let i=0
  try {
    let doc = await User.findById(userId);
    let freeTrial = doc.freeTrial;
    if(!freeTrial){
       doc = await User.findOneAndUpdate(
        { _id: userId },
        { $set: {freeTrial:0} },
        { new: true }
      );
      freeTrial = doc.freeTrial;
    }
    if(freeTrial <=10){
    while(didAnswer){
  
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      max_tokens: 1024,
      messages: messages,
  });

  const message = response.choices[0].message;
  const message_text = message.content;

  const myArray = message_text.split("Skills: ");
  skills = myArray[1]

  if(skills){
    didAnswer = false
  }else{
    i++
    if(i>=2) {
      console.log("Try",i)
      didAnswer = true
      res.status(201).send({ status: "error", data:"unable to ask the AI, Please modify your prompt" });
    }
  }
}
await User.findOneAndUpdate(
  { _id: userId },
  { $set: {freeTrial:(freeTrial+1)} },
  { new: true }
);
res.status(201).send({ status: "Success", data:skills });
    }else{
      res.status(201).send({ status: "error", data:"Your Trial Ended" });
    }

  } catch (err) {
    next(err);
  }
};


export async function addResume(req, res) {
  try {
  
    const resume = new Resume(req.body);
    resume.save()
        res.status(201).send({ status: "Success", data: resume });
  } catch (error) {
    return res.status(201).send({ status: "error", data: error });
  }
}

export const deleteResume = async (req, res, next) => {
  try {
    const { id } = req.params;
    const d = await Resume.findById(id);
    User.updateOne(
      { _id: d.User },
      { $pull: { Resumes: id } },
      (error, result) => {
        if (error) {
          console.error("Error updating document:", error);
        } else {
          console.log("Element removed from array:", result);
        }
      }
    );

    await Resume.findByIdAndDelete(id);
    res.status(200).json({ status: "Success", data: id });
  } catch (err) {
    next(err);
  }
};
export const getResume = async (req, res, next) => {
  const { id } = req.query;
  try {
    const doc = await Resume.findById(id);
    res.status(200).json(doc);
  } catch (err) {
    next(err);
  }
};





export const fetchUsersResumes = async (req, res, next) => {
  try {
    const id = req.params.id;

    const resumes = await Resume.find({ user: id }); 

    res.status(200).json(resumes);
  } catch (err) {
    next(err);
  }
};


export const getResumes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) - 1 || 0;
    const limit = parseInt(req.query.limit) || 5;
    const search = req.query.search || "";
    let status = req.query.status || "All";
    let researchArea = req.query.researchArea || "";

    const statusOptions = [
      "Screening",
      "Did Not Pass Screening",
      "Reviewing",
      "Payment Verified Waiting For DOI",
      "Payment Verified And DOI is Added",
      "Did Not Pass Review",
      "Published",
    ];


    status === "All"
      ? (status = [...statusOptions])
      : (status = req.query.status.split(","));

    const Resumes = await Resume.find({
      title: { $regex: search, $options: "i" },
    })
      .where("status")
      .in([...status])

      .skip(page * limit)
      .limit(limit);

    const total = await Resume.countDocuments({
      status: { $in: [...status] },
      title: { $regex: search, $options: "i" },
    });

    const response = {
      error: false,
      total,
      page: page + 1,
      limit,
      search,
      Resumes,
      status,
    };

    res.status(200).json(response);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: true, message: "Internal Server Error" });
  }
};

