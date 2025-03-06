const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const generateOTP = () => {
  let otp = "";
  for (let i = 0; i < 6; i++) {
    otp += numbers[crypto.getRandomValues(new Uint32Array(1))[0] % 10];
  }
  return otp;
};
