// Market Street Railway's dimensions and side elevation of ex-Philadelphia 2123.
// X runs toward the windshield. Cabinet and truck coordinates use the original
// 3.629-unit body length; the cab and the folding leaves are drawn in metres.
export const pccDimensions={
  length:(48+5/12)*.3048*.06,width:(8+4/12)*.3048*.06,height:(10+3/12)*.3048*.06,
};
export const pccLengthScale=pccDimensions.length/3.629;
export const pccFrontDoorX=1.521,pccFrontLeafWidth=.410;
export const pccCabDoorZ=(1.801-pccFrontDoorX)*pccLengthScale/.06-1.04;
export const pccTruckHalfSpacing=.875,pccAxleHalfSpacing=.242;
