import * as anchor from "@coral-xyz/anchor";

import { Program, PublicKey } from "./metaDAO";

export type AddressAndBump = [PublicKey, number];

export class PDAGenerator {
  program: Program;

  constructor(program: Program) {
    this.program = program;
  }

  generateMetaDAOPDAAddress(): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );
  }

  generateMemberPDAAddress(name: string): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("member"),
        anchor.utils.bytes.utf8.encode(name),
      ],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );
  }

  generateTreasuryPDAAddress(memberAddress: PublicKey): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("treasury"), memberAddress.toBuffer()],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );
  }

  generateConditionalExpressionPDAAddress(
    proposal: PublicKey,
    redeemableOnPass: boolean
  ): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("conditional_expression"),
        proposal.toBuffer(),
        Buffer.from([redeemableOnPass]),
      ],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );
  }

  generateVaultPDAAddress(
    conditionalExpressionAddress: PublicKey,
    underlyingMint: PublicKey
  ): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("vault"),
        conditionalExpressionAddress.toBuffer(),
        underlyingMint.toBuffer(),
      ],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );
  }

  generateDepositSlipPDAAddress(
    conditionalVault: PublicKey,
    user: PublicKey
  ): AddressAndBump {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("deposit_slip"),
        conditionalVault.toBuffer(),
        user.toBuffer(),
      ],
      new PublicKey("6ciR2XhYjPoJBZwXiwAwNearGHDjT32aR89fp8oJ5CLj")
    );
  }
}
