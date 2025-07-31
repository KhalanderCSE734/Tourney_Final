import bcrypt from 'bcryptjs';

import validator from 'validator';


import PlayerModel from '../../Models/Player/PlayerModel.js';

import cloudinary from '../../Config/cloudinary.js';


import { setUserTokenAndCookie } from '../../Middlewares/jwtAuth.js';


import generateSecureOTP from '../../Config/getOTP.js';

import transporter from '../../Config/nodemailer.js';

import Tournament from '../../Models/Organizer/Tournament.js';

import Event from '../../Models/Organizer/Event.js';

import Fixture from '../../Models/Fixture/FixtureModel.js';
// Public: Get all organizations (for player)
import Organizer from '../../Models/Organizer/OrganizerModel.js';


const signUp = async (req,res)=>{
    try{

        const { fullName, email, password, phoneNumber, dateOfBirth, aadhaarCard } = req.body;

        if(!fullName || !email || !password || !phoneNumber || !dateOfBirth || !aadhaarCard){
            return res.json({success:false,message:`All Fields Are Mandatory`});
        }


        if(!validator.isEmail(email)){
            return res.json({success:false,message:`Please Provide The Proper Mail`});
        }

        if(password.length<8){
            return res.json({success:false,message:`Password Must be minimum of length 8`});
        }


        const userExists = await PlayerModel.findOne({email});

        if(userExists && userExists.isAccountVerified){
            return res.json({success:false,message:`User With Provided Mail Already Exists`});
        }

        const saltRound = await bcrypt.genSalt(10);

        const hashedPassword = await bcrypt.hash(password,saltRound);




        const {OTP,hashedOTP,expiredAt} = await generateSecureOTP();

        // console.log(OTP,hashedOTP,expiredAt);


        let newUser = "";
        let updatedUser = "";

         const image = await cloudinary.uploader.upload(aadhaarCard);

         const uploadURL = image.secure_url;


        if(!userExists){

            newUser = await PlayerModel.create({
                fullName,
                email,
                phone:phoneNumber,
                DateOfBirth:dateOfBirth,
                password:hashedPassword,
                aadhaarImage:uploadURL,
                verifyOtp:hashedOTP, 
                verifyOtpExpiredAt: expiredAt
            })
            
        }else{
            updatedUser = await PlayerModel.findOneAndUpdate({email},
                {
                    $set:{
                       fullName,
                       email,
                       phone:phoneNumber,
                       DateOfBirth:dateOfBirth,
                       password:hashedPassword,
                       aadhaarImage:uploadURL,
                       verifyOtp:hashedOTP, 
                       verifyOtpExpiredAt: expiredAt
                    }
                }
            )
        }

        console.log(newUser,updatedUser);

        try{
           

            const mailOption = {
                from:`Tourney 24 <${process.env.SENDER_EMAIL_SMT}>`,
                to:email,
                subject:`Welcom To Tourney 24 Community`,
                html: `
                  <h1> Hello ${fullName}</h1>
                  <h2>We Heartly Welcome You as Player in Tourney 24  </h2>
                  <p>Enter the OTP <h1>  <b> ${OTP} </b> </h1> To Create Account With The Provided email: <strong>${email}</strong></p>
                  <p>Enjoy your experience 💖</p>
                  
                `,
            }

            

            const info = await transporter.sendMail(mailOption);
            // console.log(`Mail Has been Sent With The message id :- ${info}, ${info.messageId}`); 

        }catch(error){
            console.log(`Error while Generating the mail ${error}, ${error.message}`);
            return res.json({success:false,message:"Error In Sending OTP to Player's Email"});
        }



        
        res.json({success:true,message:`OTP Has Been Sent SuccessFully`});


    }catch(error){
        console.log(`Error In Signup End-Point of User (Player) ${error}`);
        res.json({success:false,message:`Error In Signup End Point ${error}`});
    }
}

const getAllPublicTournaments = async (req, res) => {
    try {
      // First try without type filter to see if you get any results
      const tournaments = await Tournament.find({});
      console.log("Tournaments found:", tournaments.length);
    
      return res.json({ success: true, message: tournaments });
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      return res.json({ success: false, message: "Error fetching tournaments" });
    }
  };
  
  const getTournamentEvents = async (req, res) => {
    try {
      const { id } = req.params;
      const events = await Event.find({ tournament: id });
      console.log(events);
      return res.json({ success: true, message: events });
    } catch (error) {
      console.error("Error fetching events:", error);
      return res.json({ success: false, message: "Error fetching events" });
    }
  };
  




const verifyEmailWithOTP = async (req,res)=>{
    try{

        const { OTP, playerMail } = req.body;

        console.log(req.body);

        if(!OTP){
            return res.json({sucess:false,message:"Enter the OTP"});
        }

        const player = await PlayerModel.findOne({email:playerMail});
        console.log(player);
        if(!player){
            return res.json({success:false,message:"Email Not Found"});
        }

        console.log(player);
        
        if(player.verifyOtp==""){
            return res.json({success:false,message:`OTP Is Not Found`})
        }

        console.log(OTP,player.verifyOtp);
        console.log(String(OTP));

        const isOTPVerified = await bcrypt.compare(String(OTP),player.verifyOtp);

        if(player.verifyOtp=='' || !isOTPVerified){
            return res.json({success:false,message:`Invalid OTP`});
        }

        if(player.verifyOtpExpiredAt < Date.now()){
            return res.json({success:false,message:`OTP Has Been Expired`});
        }

        const newUser = await PlayerModel.findOneAndUpdate(
            {email:playerMail},
            {
                $set:{
                    isAccountVerified:true,
                    verifyOtp:"",
                    verifyOtpExpiredAt:0,
                }
            },
            {new:true}
        ) 

        setUserTokenAndCookie(newUser,res);

        return res.json({success:true,message:`Account Has Been Created And Verified Succcessfully, Continue Registering for Events`});



    }catch(error){
       console.log(`Error in the verify OTP (BackEnd) ${error}`);
        return res.json({success:false,message:`Error in the verify OTP (BackEnd) ${error}`});
    }
}




const login = async (req,res)=>{
    try{

        const { email, password } = req.body;
        
        if(!email || !password) {
            return res.json({success:true,message:`All Mentioned Fields Are Mandatory To Sign up`});
        }

        const user = await PlayerModel.findOne({email});

        if(!user){
            return res.json({success:false,message:`User With the Provided Mail Doesn't Exist `});
        }
        
        if(!user.isAccountVerified){
            return res.json({succes:false,message:`User With the Provided Mail Doesn't Exist, Please Sign Up to continue`});
        }

        const isPassWordCorrect = await bcrypt.compare(password,user.password); 

        if(!isPassWordCorrect){
            return res.json({success:false,message:`Incorrect PassWord, Please Try Again`});
        }

        setUserTokenAndCookie(user,res);

        return res.json({success:true,message:`Player Logged In SuccessFully`});


    }catch(error){
        console.log(`Error in Login End Point of Player ${error}`);
        res.json({success:false,message:`Error In Login End Point ${error}`});
    }
}




const checkPlayerAuthorization = async (req,res)=>{

    try{

        return res.json({success:true,message:`Player is Authorised`});

    }catch(error){
        console.log(`Error In CHecking Player Authorisation End Point ${error}`);
        res.json({success:false,message:`Error In Checking Player Authorization Rotue, ${error}`});
    }

}



const getCurrentPlayer = async (req,res)=>{
    
    try{

        
        const  playerId  = req.user;
        // console.log(userId);
        if(!playerId){
            return res.json({success:false,message:`Player is Not Authorized`});
        }
       
        const player = await PlayerModel.findById(playerId).select(['-password']);

        if(!player){
            return res.json({success:false,message:`Player Doesn't Exist `});
        }

        

        return res.json({success:true,message:player});

          
    }catch(error){
        console.log(`Error In Getting Player Data End Point ${error}`);
        res.json({success:false,message:`Error In Getting Player Data End Point, ${error}`});
    }

}




const logOut = async (req,res)=>{
    try{

        res.clearCookie('JWT_User',{
            httpOnly:true,
            secure:process.env.NODE_ENV === 'production',
            sameSite:process.env.NODE_ENV === 'development' ? 'strict' : 'none',
        })

        return res.json({success:true,message:`Player Logged Out Success Fully`});

    }catch(error){
        console.log(`Error In LogOut of Player End Point ${error}`);
        res.json({success:false,message:`Error In LogOut of Player End Point, ${error}`});
    }
}






export const sendForgotPassOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(email)) {
      return res.json({ success: false, message: "Enter a valid email." });
    }

    const player = await PlayerModel.findOne({ email: email.toLowerCase() });
    if (!player) {
      return res.json({ success: false, message: "No account found with this email." });
    }
    if (!player.isAccountVerified) {
      return res.json({ success: false, message: "Player must verify account first." });
    }

    const { OTP, hashedOTP, expiredAt } = await generateSecureOTP();

    player.forgotPassOtp = hashedOTP;
    player.forgotPassOtpExpiredAt = expiredAt;
    player.canResetPassword = false; // Lock/disable until verified
    await player.save();

    const mailOptions = {
      from: `Tourney 24 <${process.env.SENDER_EMAIL_SMT}>`,
      to: email,
      subject: `Tourney24 Password Reset OTP`,
      html: `
        <h2>Password Reset OTP</h2>
        <p>Hello ${player.fullName},<br />
        Your OTP to reset your password: <b>${OTP}</b></p>
        <p>This OTP is valid for 5 minutes only.</p>
      `,
    };
    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "OTP sent to your email." });
  } catch (error) {
    console.error("sendForgotPassOTP error [Player]:", error);
    res.json({ success: false, message: "Failed to send OTP. Please try again later." });
  }
};



export const verifyForgotPassOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.json({ success: false, message: "Email and OTP are required." });
    }
    const player = await PlayerModel.findOne({ email: email.toLowerCase() });
    if (!player || !player.forgotPassOtp) {
      return res.json({ success: false, message: "Please request OTP again." });
    }
    if (player.forgotPassOtpExpiredAt < Date.now()) {
      player.forgotPassOtp = "";
      player.forgotPassOtpExpiredAt = 0;
      player.canResetPassword = false;
      await player.save();
      return res.json({ success: false, message: "OTP has expired. Request again." });
    }
    const isMatch = await bcrypt.compare(String(otp), player.forgotPassOtp);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid OTP." });
    }
    player.canResetPassword = true;
    player.forgotPassOtp = "";
    player.forgotPassOtpExpiredAt = 0;
    await player.save();
    res.json({ success: true, message: "OTP verified. You can reset your password now." });
  } catch (error) {
    console.error("verifyForgotPassOTP error [Player]:", error);
    res.json({ success: false, message: "Failed to verify OTP. Please try again." });
  }
};



export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword || newPassword.length < 8) {
      return res.json({ success: false, message: "Valid email and password required (8 characters min)." });
    }
    const player = await PlayerModel.findOne({ email: email.toLowerCase() });
    if (!player || !player.canResetPassword) {
      return res.json({ success: false, message: "OTP validation expired or not verified. Start again." });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    player.password = hashedPassword;
    player.canResetPassword = false;
    await player.save();
    res.json({ success: true, message: "Password has been reset successfully." });
  } catch (error) {
    console.error("resetPassword error [Player]:", error);
    res.json({ success: false, message: "Failed to reset password. Try again." });
  }
};












const getTournamentById = async (req, res) => {
  try {
    const { id } = req.params;
    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.json({ success: false, message: 'Tournament not found' });
    }
    return res.json({ success: true, message: tournament });
  } catch (error) {
    console.error('Error fetching tournament:', error);
    return res.json({ success: false, message: 'Error fetching tournament' });
  }
};



// Public: Get fixtures for an event (matches between teamA and teamB)
const getEventFixtures = async (req, res) => {
  try {
    const { id } = req.params;
    // Fetch the event to determine eventType
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    // Always use the raw ObjectId for teamA/teamB and check all three collections
    // const Team = (await import('../../Models/Organizer/Teams.js')).default;
    const TeamIndividual = (await import('../../Models/Organizer/TeamIndividual.js')).default;
    const TeamGroup = (await import('../../Models/Organizer/TeamGroup.js')).default;
 
    let rawFixtures = await Fixture.find({ event: id });
    let fixtures = await Promise.all(rawFixtures.map(async (fixture) => {
      let teamA = null, teamB = null;
      if (fixture.teamA) {       
        if (!teamA) {
          let ti = await TeamIndividual.findById(fixture.teamA);
          if (ti) teamA = { _id: ti._id, teamName: ti.name };
          else {
            let tg = await TeamGroup.findById(fixture.teamA);
            if (tg) teamA = { _id: tg._id, teamName: tg.teamName };
          }
        }
      } 
      if (fixture.teamB) {
        
        if (!teamB) {
          let ti = await TeamIndividual.findById(fixture.teamB);
          if (ti) teamB = { _id: ti._id, teamName: ti.name };
          else {
            let tg = await TeamGroup.findById(fixture.teamB);
            if (tg) teamB = { _id: tg._id, teamName: tg.teamName };
          }
        }
      }
      return {
        ...fixture.toObject(),
        teamA,
        teamB,
      };
    }));
    return res.json({ success: true, fixtures });
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return res.status(500).json({ success: false, message: 'Error fetching fixtures' });
  }
};

const getAllOrganizationsPublic = async (req, res) => {
  try {
    // Fetch all documents, only return organizationName
    const organizations = await Organizer.find({ organizationName: { $ne: '' } })
      .select('organizationName _id');
    return res.json({ success: true, organizations });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return res.status(500).json({ success: false, message: 'Error fetching organizations' });
  }
};

const getTournamentsByOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const tournaments = await Tournament.find({ organization: id });
    return res.json({ success: true, tournaments });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    return res.status(500).json({ success: false, message: 'Error fetching tournaments' });
  }
};

const updateFixtureScore = async (req, res) => {
  try {
    const { fixtureId } = req.params;
    if (!fixtureId) {
      return res.status(400).json({ success: false, message: 'Invalid fixture id' });
    }
    const allowed = ['status', 'scoreA', 'scoreB', 'winner', 'notes', 'sets'];
    const updateData = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });
    const updated = await Fixture.findByIdAndUpdate(fixtureId, updateData, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Fixture not found' });
    return res.json({ success: true, fixture: updated });
  } catch (error) {
    console.error('Error updating fixture:', error);
    return res.status(500).json({ success: false, message: 'Error updating fixture' });
  }
};

// Search fixture by team names
import TeamIndividual from '../../Models/Organizer/TeamIndividual.js';
import TeamGroup from '../../Models/Organizer/TeamGroup.js';

const searchFixtureByTeams = async (req, res) => {
  try {
    const { teamA, teamB } = req.query;
    if (!teamA || !teamB) {
      return res.status(400).json({ success: false, message: 'Both teamA and teamB are required' });
    }
    const allFixtures = await Fixture.find({});
    for (const fix of allFixtures) {
      // Resolve teamA name
      let teamAObj = await TeamIndividual.findById(fix.teamA);
      let teamAName = teamAObj ? teamAObj.name : null;
      if (!teamAName) {
        const groupA = await TeamGroup.findById(fix.teamA);
        teamAName = groupA ? groupA.teamName : null;
      }
      // Resolve teamB name
      let teamBObj = await TeamIndividual.findById(fix.teamB);
      let teamBName = teamBObj ? teamBObj.name : null;
      if (!teamBName) {
        const groupB = await TeamGroup.findById(fix.teamB);
        teamBName = groupB ? groupB.teamName : null;
      }
      // Compare both orders, case-insensitive
      if (
        (teamAName && teamBName &&
          ((teamAName.toLowerCase() === teamA.toLowerCase() && teamBName.toLowerCase() === teamB.toLowerCase()) ||
          (teamAName.toLowerCase() === teamB.toLowerCase() && teamBName.toLowerCase() === teamA.toLowerCase()))
        )
      ) {
        return res.json({ success: true, fixture: fix, teamAName, teamBName });
      }
    }
    return res.status(404).json({ success: false, message: 'No match found' });
  } catch (error) {
    console.error('Error searching fixture by teams:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Public: Register a group team for an event (player)
const createGroupTeamPlayer = async (req, res) => {
  try {
    const { TournamentId, eventId } = req.params;
    if (!TournamentId || !eventId) {
      return res.json({
        success: false,
        message: `Tournament and Event Id's are mandatory for Creating Players`,
      });
    }
    const tournament = await Tournament.findById(TournamentId);
    const event = await Event.findById(eventId);
    if (!tournament || !event) {
      return res.json({
        success: false,
        message: `Tournament (Event) Not Found`,
      });
    }
    const { teamName, members, entry } = req.body;
    if (!teamName || !members || !Array.isArray(members) || members.length === 0) {
      return res.json({ success: false, message: `All Fields are mandatory` });
    }
    let FinalMembers = [];
    for (const member of members) {
      const { name, email, mobile, academyName, feesPaid } = member;
      if (!name || !email || !mobile || !academyName) {
        return res.json({
          success: false,
          message: `All Fields are mandatory to Fill`,
        });
      }
      FinalMembers.push({
        name,
        email,
        mobile,
        academyName,
        feesPaid: typeof feesPaid === 'boolean' ? feesPaid : false,
        customFields: member.customFields || {},
      });
    }
    if (FinalMembers.length === 0) {
      return res.json({
        success: false,
        message: "No valid players found in the team",
      });
    }
    const newTeam = await TeamGroup.create({
      teamName,
      members: FinalMembers,
      entry: typeof entry === 'string' ? entry : 'online',
      event: event.name,
      eventId,
      tournamentId: TournamentId,
      dateAndTime: new Date().toISOString(),
    });
    tournament.participantsGroup.push(newTeam._id);
    await tournament.save();
    event.participantsGroup.push(newTeam._id);
    event.numberOfParticipants = event.numberOfParticipants + 1;
    await event.save();
    return res.json({
      success: true,
      message: "New Team Created Successfully",
      teamId: newTeam._id,
    });
  } catch (error) {
    console.log("Error in Creating group Team (Player)", error);
    return res.json({
      success: false,
      message: `Error in Creating Players (Group): ${error.message}`,
      error: error.stack,
    });
  }
};

// Public: Register an individual team for an event (player)
const createIndividualTeamPlayer = async (req, res) => {
  try {
    const { TournamentId, eventId } = req.params;
    if (!TournamentId || !eventId) {
      return res.json({
        success: false,
        message: `Tournament and Event Id's are mandatory for Creating Players`,
      });
    }
    const tournament = await Tournament.findById(TournamentId);
    const event = await Event.findById(eventId);
    if (!tournament || !event) {
      return res.json({
        success: false,
        message: `Tournament (Event) Not Found`,
      });
    }
    const { name, email, mobile, academyName, feesPaid, customFields, entry } = req.body;
    if (!name || !email || !mobile || !academyName) {
      return res.json({
        success: false,
        message: `All Fields are mandatory to Fill`,
      });
    }
    // Try to find player by email (optional for public registration)
    let playerObj = await PlayerModel.findOne({ email });
    let playerId = playerObj ? playerObj._id : undefined;
    const newIndividual = await TeamIndividual.create({
      player: playerId, // can be undefined
      name,
      email,
      mobile,
      academyName,
      feesPaid: typeof feesPaid === 'boolean' ? feesPaid : false,
      tournamentId: TournamentId,
      event: event.name,
      eventId,
      dateAndTime: new Date().toISOString(),
      customFields: customFields && Object.keys(customFields).length > 0 ? customFields : undefined,
      entry: typeof entry === 'string' ? entry : 'online',
    });
    tournament.participantsIndividual.push(newIndividual._id);
    await tournament.save();
    event.participantsIndividual.push(newIndividual._id);
    event.numberOfParticipants = event.numberOfParticipants + 1;
    await event.save();
    return res.json({
      success: true,
      message: "Individual Team Registered Successfully",
      teamId: newIndividual._id,
    });
  } catch (error) {
    console.log("Error in Creating Individual Team (Player)", error);
    return res.json({
      success: false,
      message: `Error in Creating Player (Individual): ${error.message}`,
      error: error.stack,
    });
  }
};



// Check if all emails are registered
const checkEmailsRegistered = async (req, res) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.json({ success: false, message: 'No emails provided.' });
    }
    const found = await PlayerModel.find({ email: { $in: emails } }).select('email');
    const foundEmails = found.map(p => p.email);
    const missing = emails.filter(e => !foundEmails.includes(e));
    if (missing.length > 0) {
      return res.json({ success: false, message: `Not registered: ${missing.join(', ')}` });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: false, message: 'Server error during email check.' });
  }
};

// Get event details by ID
export const getEventDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find the event by ID
        const event = await Event.findById(id).lean();
        
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // Get the tournament details separately
        const tournament = await Tournament.findById(event.tournament)
            .select('name location startDate endDate coverImage sport description status isVerified')
            .lean();

        // Combine event and tournament data
        const eventWithTournament = {
            ...event,
            tournament: tournament || null
        };

        // Return the event details with tournament
        res.status(200).json({ 
            success: true, 
            message: eventWithTournament
        });
    } catch (error) {
        console.error('Error fetching event details:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching event details',
            error: error.message 
        });
    }
};

export { 
    signUp, verifyEmailWithOTP, login, checkPlayerAuthorization, getCurrentPlayer, logOut, 
    getAllPublicTournaments, getTournamentEvents, getTournamentById, getAllOrganizationsPublic, 
    getTournamentsByOrganization, getEventFixtures, updateFixtureScore, searchFixtureByTeams, 
    checkEmailsRegistered, createGroupTeamPlayer, createIndividualTeamPlayer
};